import { Capacitor } from '@capacitor/core';
import { createNativeGoogleAuth } from './nativeGoogleAuth';
import { getCollectionName } from './statuses';
import { clearPendingIds } from './utils/pendingSync';

/**
 * Optional cloud sync to the user's own Google Drive.
 *
 * Data lives in the Drive *appDataFolder* — a hidden folder only this OAuth
 * client can read. The browser talks to Google directly; there is no KanDOne
 * server or database in the path, so the app's operator has no copy of anyone's
 * tasks. That is the reason this replaced Firestore.
 *
 * Each device writes only its own file (`kandone-<deviceId>.json`) and reads
 * everyone's, keeping the newest version of each record. Drive v3 has no
 * conditional write, so one shared file would let two devices silently
 * overwrite each other; with one writer per file there is nothing to overwrite.
 *
 * The exported API mirrors the previous Firestore module, except that
 * `loadAllItems` also reports deleted ids (see resolveTasksOnSignIn). Every
 * write resolves only once it has actually landed in Drive.
 */

const FILE_PREFIX = 'kandone-';
const DOCUMENT_VERSION = 1;
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid email profile';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const LOCK_NAME = 'kandone-drive-write';

// Kept in localStorage, not sessionStorage, so a new tab or a reload within the
// token's hour does not demand another click. The token is scoped to this
// app's hidden Drive folder only and expires on Google's side regardless.
const SESSION_KEY = 'kandone_drive_session_v1';
const DEVICE_KEY = 'kandone_drive_device_v1';

/** Treat a token as expired a little early so no request starts with one about to die. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

/**
 * The Android app renews through the OS, which hands back the *same* token
 * until it has actually expired, so renewal must wait almost to the end.
 */
const NATIVE_TOKEN_EXPIRY_MARGIN_MS = 5_000;

/** After a failed silent renewal, wait this long before trying again on its own. */
const RENEWAL_BACKOFF_MS = 5 * 60_000;

/** Coalesce bursts of edits (drag, typing) into one Drive upload. */
const DEFAULT_FLUSH_DELAY_MS = 1500;

/** Error raised for any failed Drive or Google sign-in request. */
export class DriveSyncError extends Error {
  constructor(message, { status = 0, code = '', cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'DriveSyncError';
    this.status = status;
    this.code = code;
  }
}

/** Errors that retrying will not fix, so the file is skipped rather than failing the read. */
const isPermanentlyUnreadable = (err) => err?.status === 404
  || err?.code === 'corrupt-file' || err?.code === 'unsupported-version';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function emptyDocument(device) {
  return { version: DOCUMENT_VERSION, device, profile: {}, collections: {} };
}

const isRecordEntry = (entry) => isPlainObject(entry) && Number.isFinite(entry.at)
  && (entry.item === null || isPlainObject(entry.item));

const isProfileEntry = (entry) => isPlainObject(entry) && Number.isFinite(entry.at) && 'value' in entry;

function keepEntries(map, isValid) {
  return isPlainObject(map)
    ? Object.fromEntries(Object.entries(map).filter(([, entry]) => isValid(entry)))
    : {};
}

/**
 * Validate one device file. Throws rather than returning an empty document:
 * an unreadable file treated as empty would be overwritten and its data lost.
 */
export function parseDeviceDocument(raw) {
  if (!isPlainObject(raw) || typeof raw.device !== 'string') {
    throw new DriveSyncError('Drive sync file is not in the expected format.', { code: 'corrupt-file' });
  }
  if (raw.version !== DOCUMENT_VERSION) {
    throw new DriveSyncError('Drive sync file was written by a newer KanDOne. Update the app.', { code: 'unsupported-version' });
  }
  const collections = isPlainObject(raw.collections)
    ? Object.fromEntries(Object.entries(raw.collections).map(([name, items]) => [name, keepEntries(items, isRecordEntry)]))
    : {};
  return { version: DOCUMENT_VERSION, device: raw.device, profile: keepEntries(raw.profile, isProfileEntry), collections };
}

/**
 * Apply queued writes to this device's own document, stamping each with `at`.
 * Pure: returns a new document. Deletes are kept as tombstones (`item: null`)
 * so they win over an older copy of the record in another device's file.
 */
export function applyOperations(document, operations, at) {
  const next = {
    ...document,
    profile: { ...document.profile },
    collections: Object.fromEntries(
      Object.entries(document.collections).map(([name, items]) => [name, { ...items }]),
    ),
  };
  for (const op of operations) {
    if (op.type === 'profile') {
      for (const [field, value] of Object.entries(op.data)) next.profile[field] = { value, at };
    } else {
      next.collections[op.collection] ??= {};
      const item = op.type === 'upsert' ? op.item : null;
      const id = op.type === 'upsert' ? op.item.id : op.id;
      next.collections[op.collection][String(id)] = { item, at };
    }
  }
  return next;
}

/** Newest entry wins; a tie goes to the higher device id so every reader agrees. */
function newer(current, candidate) {
  if (!current) return candidate;
  if (candidate.at !== current.at) return candidate.at > current.at ? candidate : current;
  return candidate.device > current.device ? candidate : current;
}

/** Latest `at` in a document, so the next write can be stamped after it. */
function latestStamp(document) {
  const stamps = [
    ...Object.values(document.profile).map((entry) => entry.at),
    ...Object.values(document.collections).flatMap((items) => Object.values(items).map((entry) => entry.at)),
  ];
  return Math.max(0, ...stamps);
}

/**
 * Stamp for the next write: the wall clock, but never earlier than anything
 * already read. A device whose clock runs behind would otherwise lose every
 * edit to an older one written by a device whose clock runs ahead.
 */
export function nextStamp(now, latestSeen) {
  return Math.max(now, latestSeen + 1);
}

/**
 * Merge every device's file into one view. `collections` holds the live
 * records; `deleted` holds the ids whose newest entry is a delete, so a
 * device still holding an old local copy can drop it instead of re-uploading it.
 */
export function mergeDeviceDocuments(documents) {
  const profile = {};
  const collections = {};
  for (const doc of documents) {
    for (const [field, entry] of Object.entries(doc.profile)) {
      profile[field] = newer(profile[field], { ...entry, device: doc.device });
    }
    for (const [name, items] of Object.entries(doc.collections)) {
      collections[name] ??= {};
      for (const [id, entry] of Object.entries(items)) {
        collections[name][id] = newer(collections[name][id], { ...entry, device: doc.device });
      }
    }
  }
  const pick = (keepDeleted) => Object.fromEntries(Object.entries(collections).map(([name, items]) => [
    name,
    Object.entries(items).filter(([, entry]) => (entry.item === null) === keepDeleted),
  ]));
  return {
    profile: Object.fromEntries(Object.entries(profile).map(([field, entry]) => [field, entry.value])),
    collections: Object.fromEntries(Object.entries(pick(false)).map(([name, entries]) => [
      name, entries.map(([, entry]) => entry.item),
    ])),
    deleted: Object.fromEntries(Object.entries(pick(true)).map(([name, entries]) => [
      name, entries.map(([id]) => id),
    ])),
  };
}

function readJson(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked or full: the session just will not survive a reload.
  }
}

function loadGisScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new DriveSyncError('Google sign-in needs a browser.', { code: 'gis-load-failed' }));
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new DriveSyncError('Could not load Google sign-in.', { code: 'gis-load-failed' }));
    document.head.appendChild(script);
  });
}

const hasWebLocks = () => typeof navigator !== 'undefined' && Boolean(navigator.locks?.request);

/**
 * Serialise writes across this browser's tabs: they share one device id and
 * therefore one Drive file. Without Web Locks each tab gets its own device id
 * instead (see `persistDeviceId`), so there is nothing to serialise across tabs.
 */
function withBrowserLock(task) {
  return hasWebLocks() ? navigator.locks.request(LOCK_NAME, task) : task();
}

function browserStorage(kind = 'localStorage') {
  try {
    return typeof window !== 'undefined' ? window[kind] : null;
  } catch {
    return null;
  }
}

/**
 * Build a Drive sync client. Dependencies are injected so tests run without
 * network, Google's script, timers, randomness or real storage.
 *
 * @param {object} deps
 * @param {string} deps.clientId OAuth Web client ID; empty disables cloud sync.
 * @param {typeof fetch} deps.fetchImpl
 * @param {() => Promise<object>} deps.loadGis resolves to the `google` global.
 * @param {Storage|null} deps.storage
 * @param {() => number} deps.now
 * @param {() => string} deps.newDeviceId
 * @param {(task: () => Promise<void>) => Promise<void>} deps.withLock
 * @param {boolean} deps.persistDeviceId share one device id (one file) across
 *   tabs. Only safe when `withLock` really excludes other tabs; otherwise two
 *   tabs could read-then-write the same file and drop each other's batch, so
 *   the id is kept per tab in `tabStorage` (it still survives a reload).
 * @param {Storage|null} deps.tabStorage per-tab storage (sessionStorage).
 * @param {number} deps.flushDelayMs
 * @param {{ requestToken: (o: { interactive: boolean }) => Promise<{access_token: string, expires_in: number}|null>,
 *   signOut: () => Promise<void> } | null} deps.nativeAuth the Android app's
 *   sign-in (see nativeGoogleAuth.js); null in a browser, which uses Google's popup.
 */
export function createDriveSync({
  clientId,
  fetchImpl,
  loadGis = loadGisScript,
  storage = browserStorage(),
  tabStorage = browserStorage('sessionStorage'),
  now = () => Date.now(),
  newDeviceId = () => crypto.randomUUID(),
  withLock = withBrowserLock,
  persistDeviceId = hasWebLocks(),
  flushDelayMs = DEFAULT_FLUSH_DELAY_MS,
  nativeAuth = null,
}) {
  let session = readJson(storage, SESSION_KEY);
  let gis = null;
  let gisLoading = null;
  let tokenClient = null;
  let pendingTokenRequest = null;
  let pendingRenewal = null;
  let expiryTimer = null;
  const listeners = new Set();

  let queue = [];
  let flushTimer = null;
  let flushChain = Promise.resolve();
  let ownFileId = null;
  let latestSeenAt = 0;

  const isConfigured = () => Boolean(clientId);
  const expiryMargin = nativeAuth ? NATIVE_TOKEN_EXPIRY_MARGIN_MS : TOKEN_EXPIRY_MARGIN_MS;

  const hasValidToken = () => Boolean(
    session?.accessToken && session.expiresAt - expiryMargin > now(),
  );

  /**
   * Who the header shows as connected. In a browser that is the token's
   * lifetime. In the app a lapsed token is renewed silently, so the user stays
   * connected until a renewal actually fails.
   */
  const currentUser = () => {
    if (!nativeAuth) return hasValidToken() ? session.user : null;
    return session?.user && !session.renewalFailedAt ? session.user : null;
  };

  /** App only: a stored account whose token can be renewed without UI, outside the post-failure backoff. */
  const canRenewSilently = () => Boolean(
    nativeAuth && session?.user
      && (!session.renewalFailedAt || now() - session.renewalFailedAt >= RENEWAL_BACKOFF_MS),
  );

  let device = null;
  const deviceStorage = persistDeviceId ? storage : tabStorage;

  /** Stable per browser and shared by its tabs; per tab when that is unsafe or storage is blocked. */
  function deviceId() {
    if (device) return device;
    device = readJson(deviceStorage, DEVICE_KEY) ?? newDeviceId();
    writeJson(deviceStorage, DEVICE_KEY, device);
    return device;
  }

  /**
   * Leave an unreadable own file where it is (readers skip it) and continue in
   * a new one. Refusing to write forever would strand every later edit locally.
   */
  function abandonOwnFile() {
    console.warn('KanDOne: own Drive sync file is unreadable; continuing in a new one.');
    device = null;
    writeJson(deviceStorage, DEVICE_KEY, null);
    ownFileId = null;
    return emptyDocument(deviceId());
  }

  const ownFileName = () => `${FILE_PREFIX}${deviceId()}.json`;

  let lastReportedUid = currentUser()?.uid ?? null;

  /**
   * Report only a change of *who is connected*. A token swap for the same user
   * is not one: TasksApp answers every report with a full pull-and-merge.
   */
  function notifyListeners() {
    const user = currentUser();
    if ((user?.uid ?? null) === lastReportedUid) return;
    lastReportedUid = user?.uid ?? null;
    for (const listener of listeners) listener(user);
  }

  /**
   * Browser only: tell the header the moment the token lapses, not on the
   * next failed save. The app renews lazily on the next Drive call instead.
   */
  function scheduleExpiryNotice() {
    clearTimeout(expiryTimer);
    if (nativeAuth || !hasValidToken()) return;
    expiryTimer = setTimeout(notifyListeners, session.expiresAt - expiryMargin - now());
  }

  function setSession(next) {
    session = next;
    writeJson(storage, SESSION_KEY, next);
    scheduleExpiryNotice();
    notifyListeners();
  }

  function ensureGis() {
    if (gis) return Promise.resolve(gis);
    gisLoading ??= loadGis().then((loaded) => { gis = loaded; return gis; })
      .catch((err) => { gisLoading = null; throw err; });
    return gisLoading;
  }

  function getTokenClient() {
    tokenClient ??= gis.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: () => {},
    });
    return tokenClient;
  }

  /**
   * Ask Google for an access token. When GIS is already loaded this opens the
   * popup synchronously, inside the click that called it — anything later and
   * the browser blocks the popup. That is why GIS is preloaded on startup.
   */
  function requestToken() {
    if (pendingTokenRequest) return pendingTokenRequest;
    if (nativeAuth) {
      pendingTokenRequest = nativeAuth.requestToken({ interactive: true })
        .then(requireToken)
        .finally(() => { pendingTokenRequest = null; });
      return pendingTokenRequest;
    }
    const run = (loaded) => new Promise((resolve, reject) => {
      gis = loaded;
      const client = getTokenClient();
      client.callback = (response) => {
        if (response.error) {
          reject(new DriveSyncError(response.error_description || response.error, { code: response.error }));
          return;
        }
        resolve(response);
      };
      client.error_callback = (err) => {
        reject(new DriveSyncError(err?.message || 'Google sign-in was closed.', { code: err?.type || 'popup_closed' }));
      };
      client.requestAccessToken({ prompt: '', login_hint: session?.user?.email || '' });
    });
    pendingTokenRequest = (gis ? run(gis) : ensureGis().then(run))
      .finally(() => { pendingTokenRequest = null; });
    return pendingTokenRequest;
  }

  function requireToken(response) {
    if (!response?.access_token) {
      throw new DriveSyncError('Google did not grant access to Drive.', { code: 'access_denied' });
    }
    return response;
  }

  const expiredSession = () => ({ ...session, accessToken: null, expiresAt: 0 });

  /**
   * App only: renew an expired token for the signed-in user without UI. A
   * failure marks the session so the header offers Connect Drive, and stops
   * every queued save from retrying the OS round-trip until the backoff ends.
   */
  function renewSilently() {
    pendingRenewal ??= nativeAuth.requestToken({ interactive: false })
      .then(requireToken)
      .then((response) => {
        setSession({
          ...session,
          accessToken: response.access_token,
          expiresAt: now() + Number(response.expires_in) * 1000,
          renewalFailedAt: null,
        });
        return response.access_token;
      })
      .catch((err) => {
        if (session) setSession({ ...expiredSession(), renewalFailedAt: now() });
        throw new DriveSyncError('Google Drive session expired.', { code: 'signed-out', cause: err });
      })
      .finally(() => { pendingRenewal = null; });
    return pendingRenewal;
  }

  async function fetchUser(accessToken) {
    const res = await fetchImpl(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new DriveSyncError('Could not read the Google account.', { status: res.status });
    const info = await res.json();
    return { uid: info.sub, email: info.email || '', displayName: info.name || '' };
  }

  async function signIn() {
    if (!isConfigured()) throw new DriveSyncError('Google Drive sync is not configured.', { code: 'not-configured' });
    const response = await requestToken();
    const user = await fetchUser(response.access_token);
    if (session?.user?.uid !== user.uid) {
      ownFileId = null;
      latestSeenAt = 0;
    }
    setSession({
      accessToken: response.access_token,
      expiresAt: now() + Number(response.expires_in) * 1000,
      user,
    });
    return user;
  }

  /**
   * Never opens a popup: a background save is not a click, so the browser
   * would block it. In a browser an expired token instead reports "signed
   * out", the header offers Connect Drive, and pendingSync replays local edits
   * on reconnect. The app renews the token silently first.
   */
  async function accessToken() {
    if (hasValidToken()) return session.accessToken;
    if (canRenewSilently()) return renewSilently();
    if (session?.accessToken) setSession(expiredSession());
    throw new DriveSyncError('Google Drive session expired.', { code: 'signed-out' });
  }

  async function driveFetch(url, init = {}, retried = false) {
    const token = await accessToken();
    const res = await fetchImpl(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 && session) {
      // Revoked or expired early: drop the token. A browser then offers to
      // reconnect; the app (still connected) renews and retries once.
      setSession(expiredSession());
      if (canRenewSilently() && !retried) return driveFetch(url, init, true);
    }
    if (!res.ok) throw new DriveSyncError(`Google Drive request failed (${res.status}).`, { status: res.status });
    return res;
  }

  async function listFiles(query, pageToken = '') {
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      q: query,
      fields: 'nextPageToken,files(id,name)',
      pageSize: '1000',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const page = await (await driveFetch(`${DRIVE_API}/files?${params}`)).json();
    const files = page.files ?? [];
    return page.nextPageToken ? [...files, ...await listFiles(query, page.nextPageToken)] : files;
  }

  async function readFile(id) {
    const res = await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(id)}?alt=media`);
    // Read the body first: a connection dropped mid-download must surface as a
    // network error, not be mistaken for a corrupt file and abandoned.
    const text = await res.text();
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new DriveSyncError('Drive sync file is not valid JSON.', { code: 'corrupt-file' });
    }
    return parseDeviceDocument(raw);
  }

  /**
   * Every device's file, merged. A file that can never be read (corrupt,
   * written by a newer version, deleted since the listing) is skipped: one bad
   * file must not stop every device from syncing. Any other failure (network,
   * rate limit, auth) fails the whole read — a merge missing a device's newer
   * edits and deletes would let this device re-upload stale copies over them.
   */
  async function readMerged() {
    const files = (await listFiles(`name contains '${FILE_PREFIX}'`))
      .filter((file) => file.name.startsWith(FILE_PREFIX) && file.name.endsWith('.json'));
    const results = await Promise.allSettled(files.map((file) => readFile(file.id)));
    const fatal = results.find((r) => r.status === 'rejected' && !isPermanentlyUnreadable(r.reason));
    if (fatal) throw fatal.reason;
    const skipped = results.filter((r) => r.status === 'rejected');
    if (skipped.length) console.warn(`KanDOne: skipped ${skipped.length} unreadable Drive sync file(s).`);
    const documents = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    latestSeenAt = Math.max(latestSeenAt, ...documents.map(latestStamp));
    return mergeDeviceDocuments(documents);
  }

  async function readOwnDocument() {
    if (!ownFileId) {
      const [file] = await listFiles(`name = '${ownFileName()}'`);
      ownFileId = file?.id ?? null;
    }
    if (!ownFileId) return emptyDocument(deviceId());
    try {
      const own = await readFile(ownFileId);
      latestSeenAt = Math.max(latestSeenAt, latestStamp(own));
      return own;
    } catch (err) {
      if (err.code === 'corrupt-file') return abandonOwnFile();
      // Deleted from Drive's "Manage apps → Delete hidden app data": start a new file.
      if (err.status !== 404) throw err;
      ownFileId = null;
      return emptyDocument(deviceId());
    }
  }

  async function writeOwnDocument(document) {
    const body = JSON.stringify(document);
    if (ownFileId) {
      await driveFetch(`${DRIVE_UPLOAD_API}/files/${encodeURIComponent(ownFileId)}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      return;
    }
    const boundary = `kandone-${now()}`;
    const metadata = JSON.stringify({ name: ownFileName(), parents: ['appDataFolder'] });
    const multipart = [
      `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', metadata,
      `--${boundary}`, 'Content-Type: application/json', '', body,
      `--${boundary}--`, '',
    ].join('\r\n');
    const res = await driveFetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipart,
    });
    ownFileId = (await res.json()).id;
  }

  async function flush() {
    flushTimer = null;
    const batch = queue;
    queue = [];
    if (batch.length === 0) return;
    try {
      await withLock(async () => {
        // Re-read under the lock: another tab of this browser shares the file.
        const own = await readOwnDocument();
        const at = nextStamp(now(), latestSeenAt);
        await writeOwnDocument(applyOperations(own, batch.map((entry) => entry.op), at));
        latestSeenAt = at;
      });
      for (const entry of batch) entry.resolve();
    } catch (err) {
      for (const entry of batch) entry.reject(err);
    }
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushChain = flushChain.then(flush);
    }, flushDelayMs);
  }

  function enqueue(op) {
    if (!session) return Promise.reject(new DriveSyncError('Not connected to Google Drive.', { code: 'signed-out' }));
    return new Promise((resolve, reject) => {
      queue.push({ op, resolve, reject });
      scheduleFlush();
    });
  }

  /**
   * Clear only ids with no newer write still queued: if that later write then
   * failed, a cleared id would let the next pull overwrite it with this older copy.
   */
  function clearLandedIds(mode, ids) {
    const collection = getCollectionName(mode);
    const stillQueued = new Set(queue
      .filter(({ op }) => op.collection === collection)
      .map(({ op }) => String(op.type === 'upsert' ? op.item.id : op.id)));
    clearPendingIds(mode, ids.filter((id) => !stillQueued.has(String(id))));
  }

  /** Browser: revoke through Google's script, loaded before anything is deleted. */
  async function gisRevoker() {
    const loaded = await ensureGis();
    return (token) => new Promise((resolve) => loaded.accounts.oauth2.revoke(token, resolve));
  }

  /**
   * App: Google's script is not used there, so revoke with the plain OAuth
   * endpoint. The files are already gone by now, so a failure only leaves the
   * (now empty) grant in the user's Google account, which they can remove there.
   */
  async function revokeOverHttp(token) {
    const res = await fetchImpl(REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });
    if (!res.ok) console.warn(`KanDOne: revoking Drive access failed (${res.status})`);
  }

  /** Cancel every queued write, telling each caller it never reached Drive. */
  function dropQueuedWrites() {
    clearTimeout(flushTimer);
    flushTimer = null;
    const dropped = queue;
    queue = [];
    for (const entry of dropped) entry.reject(new DriveSyncError('Signed out before sync.', { code: 'signed-out' }));
  }

  /** Drop queued writes and forget the session; local data is the caller's to clear. */
  function endSession() {
    dropQueuedWrites();
    ownFileId = null;
    latestSeenAt = 0;
    setSession(null);
  }

  return {
    isCloudConfigured: isConfigured,

    /**
     * True when a usable token is stored, or (app only) when an expired one can
     * be renewed silently. In a browser an expired one is not restorable
     * without a click, so the header should offer Connect Drive, not "Reconnecting…".
     */
    hasRestorableSession: async () => isConfigured() && (hasValidToken() || canRenewSilently()),

    /**
     * Reports the connected user on subscribing, then on every change. In the
     * app a stored session whose token has lapsed still reports the user: the
     * first Drive call renews it, and only a failed renewal reports signed out.
     * In a browser it also starts loading Google's script, so a Connect Drive
     * click can open the popup synchronously.
     */
    onAuthChange(callback) {
      listeners.add(callback);
      scheduleExpiryNotice();
      const user = isConfigured() ? currentUser() : null;
      lastReportedUid = user?.uid ?? null;
      callback(user);
      if (isConfigured() && !nativeAuth) ensureGis().catch(() => {});
      return () => listeners.delete(callback);
    },

    signInWithGoogle: signIn,

    async signOut() {
      endSession();
      // Also forget the account on the device, so the next Connect asks again.
      // The app is already signed out locally, so a failure here is not fatal.
      if (nativeAuth) {
        await nativeAuth.signOut().catch((err) => console.warn('KanDOne: device sign-out failed', err?.message));
      }
    },

    /**
     * Delete every KanDOne sync file from the user's Drive and revoke this
     * app's access, then sign out. Google must be reachable *before* anything
     * is deleted: losing the data but keeping the grant would be the worse half.
     * A device that is still signed in uploads its local copy again on its next
     * sync, so other devices need signing out first.
     */
    async deleteAllSyncedData() {
      if (!session?.user) throw new DriveSyncError('Not connected to Google Drive.', { code: 'signed-out' });
      const revoke = nativeAuth ? revokeOverHttp : await gisRevoker();
      await accessToken();
      dropQueuedWrites();
      await flushChain;
      const files = (await listFiles(`name contains '${FILE_PREFIX}'`))
        .filter((file) => file.name.startsWith(FILE_PREFIX) && file.name.endsWith('.json'));
      await Promise.all(files.map((file) => driveFetch(
        `${DRIVE_API}/files/${encodeURIComponent(file.id)}`,
        { method: 'DELETE' },
      )));
      await revoke(session.accessToken);
      endSession();
      if (nativeAuth) {
        await nativeAuth.signOut().catch((err) => console.warn('KanDOne: device sign-out failed', err?.message));
      }
    },

    async loadUserProfile() {
      return (await readMerged()).profile;
    },

    saveUserProfile: (_uid, data) => enqueue({ type: 'profile', data }),

    async loadTaskLabels() {
      const { profile } = await readMerged();
      return Array.isArray(profile.tasksLabels) ? profile.tasksLabels : null;
    },

    saveTaskLabels: (_uid, labels) => enqueue({ type: 'profile', data: { tasksLabels: labels, appMode: 'tasks' } }),

    /**
     * Live records plus the ids whose newest version is a delete, or null when
     * Drive has never held a record of this mode (first sign-in).
     */
    async loadAllItems(_uid, mode) {
      const merged = await readMerged();
      const collection = getCollectionName(mode);
      const items = merged.collections[collection] ?? [];
      const deletedIds = merged.deleted[collection] ?? [];
      return items.length === 0 && deletedIds.length === 0 ? null : { items, deletedIds };
    },

    async updateItem(_uid, mode, item) {
      await enqueue({ type: 'upsert', collection: getCollectionName(mode), item });
      clearLandedIds(mode, [item.id]);
    },

    async deleteItem(_uid, mode, id) {
      await enqueue({ type: 'delete', collection: getCollectionName(mode), id });
      clearLandedIds(mode, [id]);
    },

    async batchSaveItems(_uid, mode, items) {
      if (!items.length) return;
      const collection = getCollectionName(mode);
      await Promise.all(items.map((item) => enqueue({ type: 'upsert', collection, item })));
      clearLandedIds(mode, items.map((item) => item.id));
    },
  };
}

/** User-facing message for a failed "Connect Drive". */
export function formatSignInError(err) {
  const code = err?.code || '';
  if (code === 'popup_failed_to_open') return 'Popup blocked. Allow popups for this site, then try again.';
  if (code === 'popup_closed' || code === 'access_denied') return 'Sign-in cancelled.';
  if (code === 'gis-load-failed') return 'Could not reach Google. Check your connection or ad blocker.';
  if (code === 'not-configured') return 'Google Drive sync is not configured for this build.';
  return err?.message || 'Sign-in failed.';
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const fetchImpl = (...args) => fetch(...args);

const driveSync = createDriveSync({
  clientId: GOOGLE_CLIENT_ID,
  fetchImpl,
  nativeAuth: Capacitor.isNativePlatform()
    ? createNativeGoogleAuth({ webClientId: GOOGLE_CLIENT_ID, fetchImpl })
    : null,
});

export const {
  isCloudConfigured, hasRestorableSession, onAuthChange, signInWithGoogle, signOut, deleteAllSyncedData,
  loadUserProfile, saveUserProfile, loadTaskLabels, saveTaskLabels,
  loadAllItems, updateItem, deleteItem, batchSaveItems,
} = driveSync;
