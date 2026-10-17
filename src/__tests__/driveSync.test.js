import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyOperations, createDriveSync, formatSignInError, mergeDeviceDocuments, nextStamp, parseDeviceDocument,
} from '../driveSync.js';
import { readPending, recordLocalChanges } from '../utils/pendingSync.js';

const NOW = 1_700_000_000_000;
const USER = { sub: 'google-sub-1', email: 'user@example.com', name: 'Dana Levi' };
const SESSION_KEY = 'kandone_drive_session_v1';

const deviceFile = (device, collections = {}, profile = {}) => ({
  name: `kandone-${device}.json`,
  body: JSON.stringify({ version: 1, device, profile, collections }),
});

/** In-memory stand-in for the Drive v3 + userinfo endpoints this module calls. */
function fakeGoogle({ files = {}, failWith = null, pageLimit = Infinity, failRead = {} } = {}) {
  const state = { files: { ...files }, nextId: 1, patched: [] };
  const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
  const raw = (text) => ({ ok: true, status: 200, text: async () => text });

  const fetchImpl = vi.fn(async (url, init = {}) => {
    if (failWith) return json({}, failWith);
    if (url === 'https://openidconnect.googleapis.com/v1/userinfo') return json(USER);
    if (url.includes('/upload/drive/v3/files?uploadType=multipart')) {
      const parts = init.body.split('\r\n');
      const id = `new-${state.nextId++}`;
      state.files[id] = { name: JSON.parse(parts[3]).name, body: parts[7] };
      return json({ id });
    }
    const patch = url.match(/\/upload\/drive\/v3\/files\/([^?]+)\?uploadType=media/);
    if (patch) {
      if (!state.files[patch[1]]) return json({}, 404);
      state.files[patch[1]].body = init.body;
      state.patched.push(patch[1]);
      return json({});
    }
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?')) {
      const params = new URL(url).searchParams;
      const exact = params.get('q').match(/^name = '(.+)'$/)?.[1];
      const list = Object.entries(state.files)
        .filter(([, f]) => (exact ? f.name === exact : f.name.startsWith('kandone-')))
        .map(([id, f]) => ({ id, name: f.name }));
      const start = Number(params.get('pageToken') || 0);
      const end = start + Math.min(pageLimit, Number(params.get('pageSize')));
      return json(end < list.length
        ? { files: list.slice(start, end), nextPageToken: String(end) }
        : { files: list.slice(start) });
    }
    const media = url.match(/\/drive\/v3\/files\/([^?]+)\?alt=media/);
    if (media && failRead[media[1]] === 'network') return { ok: true, status: 200, text: async () => { throw new TypeError('network error'); } };
    if (media && failRead[media[1]]) return json({}, failRead[media[1]]);
    if (media) return state.files[media[1]] ? raw(state.files[media[1]].body) : json({}, 404);
    throw new Error(`unexpected request ${url}`);
  });

  const stored = (id) => JSON.parse(state.files[id].body);
  return { state, fetchImpl, stored };
}

function fakeGis({ error = null } = {}) {
  const client = {
    requestAccessToken: vi.fn(() => {
      if (error) client.callback({ error });
      else client.callback({ access_token: 'token-1', expires_in: 3600 });
    }),
  };
  return { accounts: { oauth2: { initTokenClient: vi.fn(() => client) } }, client };
}

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function validSession(overrides = {}) {
  return JSON.stringify({
    accessToken: 'token-1',
    expiresAt: NOW + 3_600_000,
    user: { uid: USER.sub, email: USER.email, displayName: USER.name },
    ...overrides,
  });
}

const signedIn = () => memoryStorage({ [SESSION_KEY]: validSession() });

function build({
  google = fakeGoogle(), gis = fakeGis(), storage = memoryStorage(), clientId = 'client-id',
  withLock = (task) => task(), persistDeviceId = true, deviceIds = ['this', 'next'], tabStorage = memoryStorage(),
} = {}) {
  const ids = [...deviceIds];
  const sync = createDriveSync({
    clientId,
    fetchImpl: google.fetchImpl,
    loadGis: async () => gis,
    storage,
    tabStorage,
    now: () => Date.now(),
    newDeviceId: () => ids.shift(),
    withLock,
    persistDeviceId,
    flushDelayMs: 100,
  });
  return { sync, google, gis, storage };
}

/** Let the debounce fire and the queued Drive round-trips finish. */
async function settle() {
  await vi.advanceTimersByTimeAsync(150);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('driveSync.js', () => {
  describe('parseDeviceDocument', () => {
    it('keeps valid entries and drops malformed ones', () => {
      const parsed = parseDeviceDocument({
        version: 1,
        device: 'd1',
        profile: { labels: { value: [], at: 1 }, broken: { at: 'x' } },
        collections: { tasks: { 1: { item: { id: 1 }, at: 5 }, 2: { item: 'text', at: 5 }, 3: { item: null, at: 6 } } },
      });

      expect(parsed).toEqual({
        version: 1,
        device: 'd1',
        profile: { labels: { value: [], at: 1 } },
        collections: { tasks: { 1: { item: { id: 1 }, at: 5 }, 3: { item: null, at: 6 } } },
      });
    });

    it.each([
      ['null', null, 'corrupt-file'],
      ['an array', [], 'corrupt-file'],
      ['a file with no device id', { version: 1 }, 'corrupt-file'],
      ['a newer format', { version: 2, device: 'd1' }, 'unsupported-version'],
    ])('refuses %s instead of treating it as empty', (_name, raw, code) => {
      expect(() => parseDeviceDocument(raw)).toThrow(expect.objectContaining({ code }));
    });
  });

  describe('applyOperations', () => {
    it('stamps upserts, deletes and profile fields with the write time without touching the input', () => {
      const base = parseDeviceDocument({ version: 1, device: 'd1', collections: { tasks: { 1: { item: { id: 1 }, at: 1 } } } });

      const next = applyOperations(base, [
        { type: 'upsert', collection: 'tasks', item: { id: 2 } },
        { type: 'delete', collection: 'tasks', id: 1 },
        { type: 'profile', data: { appMode: 'tasks' } },
      ], 50);

      expect(next).toEqual({
        version: 1,
        device: 'd1',
        profile: { appMode: { value: 'tasks', at: 50 } },
        collections: { tasks: { 1: { item: null, at: 50 }, 2: { item: { id: 2 }, at: 50 } } },
      });
      expect(base.collections.tasks[1].item).toEqual({ id: 1 });
    });
  });

  describe('mergeDeviceDocuments', () => {
    it('keeps the newest version of each record and field across devices', () => {
      const doc = (device, tasks, profile = {}) => parseDeviceDocument({ version: 1, device, profile, collections: { tasks } });
      const cases = [
        ['newer edit wins', [doc('a', { 1: { item: { id: 1, v: 'old' }, at: 1 } }), doc('b', { 1: { item: { id: 1, v: 'new' }, at: 2 } })], [{ id: 1, v: 'new' }]],
        ['newer delete hides an older copy', [doc('a', { 1: { item: { id: 1 }, at: 1 } }), doc('b', { 1: { item: null, at: 2 } })], []],
        ['older delete loses to a newer edit', [doc('a', { 1: { item: { id: 1 }, at: 3 } }), doc('b', { 1: { item: null, at: 2 } })], [{ id: 1 }]],
        ['a tie goes to the higher device id', [doc('b', { 1: { item: { id: 1, v: 'b' }, at: 1 } }), doc('a', { 1: { item: { id: 1, v: 'a' }, at: 1 } })], [{ id: 1, v: 'b' }]],
        ['records only one device has are kept', [doc('a', { 1: { item: { id: 1 }, at: 1 } }), doc('b', { 2: { item: { id: 2 }, at: 1 } })], [{ id: 1 }, { id: 2 }]],
      ];

      for (const [name, docs, expected] of cases) {
        expect(mergeDeviceDocuments(docs).collections.tasks, name).toEqual(expected);
      }
    });

    it('reports the ids whose newest entry is a delete', () => {
      const doc = (device, tasks) => parseDeviceDocument({ version: 1, device, collections: { tasks } });

      const { deleted } = mergeDeviceDocuments([
        doc('a', { 1: { item: { id: 1 }, at: 1 }, 2: { item: { id: 2 }, at: 5 } }),
        doc('b', { 1: { item: null, at: 2 }, 2: { item: null, at: 4 } }),
      ]);

      expect(deleted).toEqual({ tasks: ['1'] });
    });
  });

  describe('nextStamp', () => {
    it.each([
      ['the clock is ahead of everything seen', 100, 50, 100],
      ['another device wrote with a clock running ahead', 100, 500, 501],
      ['a write landed in the same millisecond', 100, 100, 101],
    ])('stamps after %s', (_name, now, latestSeen, expected) => {
      expect(nextStamp(now, latestSeen)).toBe(expected);
    });
  });

  describe('createDriveSync', () => {
    describe('signInWithGoogle', () => {
      it('stores the session and reports the user to listeners', async () => {
        const { sync, storage } = build();
        const seen = [];
        sync.onAuthChange((u) => seen.push(u));

        const user = await sync.signInWithGoogle();

        expect(user).toEqual({ uid: USER.sub, email: USER.email, displayName: USER.name });
        expect(seen).toEqual([null, user]);
        expect(JSON.parse(storage.getItem(SESSION_KEY)).user).toEqual(user);
      });

      it('opens the Google popup synchronously once the script has preloaded, so the click is not blocked', async () => {
        const { sync, gis } = build();
        sync.onAuthChange(() => {});
        await vi.advanceTimersByTimeAsync(0);

        const pending = sync.signInWithGoogle();
        const openedInClick = gis.client.requestAccessToken.mock.calls.length;
        await pending;

        expect(openedInClick).toBe(1);
      });

      it.each([
        ['a denied consent', { gis: fakeGis({ error: 'access_denied' }) }, 'access_denied'],
        ['a build with no client id', { clientId: '' }, 'not-configured'],
      ])('rejects on %s', async (_name, options, code) => {
        const { sync } = build(options);

        await expect(sync.signInWithGoogle()).rejects.toMatchObject({ code });
      });
    });

    describe('onAuthChange', () => {
      it('reports a stored session only while its token is valid, and its expiry when it lapses', async () => {
        const { sync } = build({ storage: signedIn() });
        const seen = [];

        sync.onAuthChange((u) => seen.push(u?.email ?? null));
        await vi.advanceTimersByTimeAsync(3_600_000);

        expect(seen).toEqual([USER.email, null]);
      });
    });

    describe('hasRestorableSession', () => {
      it.each([
        ['a valid token', validSession(), 'client-id', true],
        ['an expired token', validSession({ expiresAt: NOW - 1 }), 'client-id', false],
        ['no session', null, 'client-id', false],
        ['no client id', validSession(), '', false],
      ])('is %s → %s', async (_name, stored, clientId, expected) => {
        const storage = memoryStorage(stored ? { [SESSION_KEY]: stored } : {});
        const { sync } = build({ storage, clientId });

        expect(await sync.hasRestorableSession()).toBe(expected);
      });
    });

    describe('batchSaveItems', () => {
      it('coalesces a burst of writes into one upload of this device\'s own file', async () => {
        const google = fakeGoogle({ files: { other: deviceFile('other', { tasks: { 9: { item: { id: 9 }, at: 1 } } }) } });
        const { sync } = build({ google, storage: signedIn() });
        const otherBefore = google.state.files.other.body;

        const done = Promise.all([
          sync.batchSaveItems('uid', 'tasks', [{ id: 1, title: 'a' }]),
          sync.batchSaveItems('uid', 'tasks', [{ id: 2, title: 'b' }]),
        ]);
        await settle();
        await done;

        expect(google.state.files['new-1'].name).toBe('kandone-this.json');
        expect(Object.keys(google.stored('new-1').collections.tasks)).toEqual(['1', '2']);
        expect(google.state.files.other.body).toBe(otherBefore);
      });

      it('clears a pending id once its upload lands, but not while a newer edit of it is still queued', async () => {
        recordLocalChanges('tasks', { edited: ['1', '2'] });
        let openGate;
        const gate = new Promise((resolve) => { openGate = resolve; });
        const { sync } = build({ storage: signedIn(), withLock: (task) => gate.then(task) });

        const first = sync.batchSaveItems('uid', 'tasks', [{ id: 1, v: 1 }, { id: 2, v: 1 }]);
        await vi.advanceTimersByTimeAsync(100);
        const second = sync.updateItem('uid', 'tasks', { id: 1, v: 2 });
        second.catch(() => {});
        openGate();
        await first;
        const afterFirst = [...readPending('tasks').edited];
        await settle();
        await second;

        expect([afterFirst, [...readPending('tasks').edited]]).toEqual([['1'], []]);
      });

      it('recreates its file when Drive no longer has it', async () => {
        const google = fakeGoogle();
        const { sync } = build({ google, storage: signedIn() });
        const created = sync.updateItem('uid', 'tasks', { id: 1 });
        await settle();
        await created;
        delete google.state.files['new-1'];

        const recreated = sync.updateItem('uid', 'tasks', { id: 2 });
        await settle();
        await recreated;

        expect(Object.keys(google.stored('new-2').collections.tasks)).toEqual(['2']);
      });

      it.each([
        ['signed out', null, null, { code: 'signed-out' }],
        ['the token has expired', validSession({ expiresAt: NOW - 1 }), null, { code: 'signed-out' }],
        ['Drive fails', validSession(), 500, { status: 500 }],
      ])('rejects when %s', async (_name, stored, failWith, expected) => {
        const storage = memoryStorage(stored ? { [SESSION_KEY]: stored } : {});
        const { sync } = build({ google: fakeGoogle({ failWith }), storage });

        const done = sync.batchSaveItems('uid', 'tasks', [{ id: 1 }]);
        done.catch(() => {});
        await settle();

        await expect(done).rejects.toMatchObject(expected);
      });

      it('leaves an unreadable own file untouched and continues in a new one', async () => {
        const corrupt = { name: 'kandone-this.json', body: '{"version":1' };
        const google = fakeGoogle({ files: { mine: { ...corrupt } } });
        const { sync } = build({ google, storage: signedIn() });

        const done = sync.updateItem('uid', 'tasks', { id: 1 });
        await settle();
        await done;

        expect([google.state.files.mine, google.state.files['new-1'].name]).toEqual([corrupt, 'kandone-next.json']);
      });

      it('stamps a write after the newest entry already in Drive, even if another device\'s clock runs ahead', async () => {
        const ahead = NOW + 3_600_000;
        const google = fakeGoogle({ files: { other: deviceFile('other', { tasks: { 1: { item: { id: 1, v: 'theirs' }, at: ahead } } }) } });
        const { sync } = build({ google, storage: signedIn() });
        await sync.loadAllItems('uid', 'tasks');

        const done = sync.updateItem('uid', 'tasks', { id: 1, v: 'mine' });
        await settle();
        await done;

        expect((await sync.loadAllItems('uid', 'tasks')).items).toEqual([{ id: 1, v: 'mine' }]);
      });

      it('shares one device file across tabs only when tabs can be locked against each other, and keeps it across a reload', async () => {
        const results = [];
        for (const persistDeviceId of [true, false]) {
          const storage = signedIn();
          const google = fakeGoogle();
          const firstTab = memoryStorage();
          const opens = [[firstTab, ['tab-1']], [memoryStorage(), ['tab-2']], [firstTab, ['tab-1-reloaded']]];
          for (const [tabStorage, deviceIds] of opens) {
            const { sync } = build({ google, storage, persistDeviceId, deviceIds, tabStorage });
            const done = sync.updateItem('uid', 'tasks', { id: 1 });
            await settle();
            await done;
          }
          results.push(Object.values(google.state.files).map((f) => f.name));
        }

        expect(results).toEqual([['kandone-tab-1.json'], ['kandone-tab-1.json', 'kandone-tab-2.json']]);
      });
    });

    describe('deleteItem', () => {
      it('hides the record even though another device still holds an older copy', async () => {
        const google = fakeGoogle({ files: { other: deviceFile('other', { tasks: { 1: { item: { id: 1 }, at: NOW - 10 } } }) } });
        const { sync } = build({ google, storage: signedIn() });

        const done = sync.deleteItem('uid', 'tasks', 1);
        await settle();
        await done;

        expect(await sync.loadAllItems('uid', 'tasks')).toEqual({ items: [], deletedIds: ['1'] });
      });
    });

    describe('loadAllItems', () => {
      it.each([
        ['no files yet', {}, null],
        ['two devices', {
          a: deviceFile('a', { tasks: { 1: { item: { id: 1 }, at: 1 } } }),
          b: deviceFile('b', { tasks: { 2: { item: { id: 2 }, at: 1 } } }),
        }, { items: [{ id: 1 }, { id: 2 }], deletedIds: [] }],
        ['another device\'s file is corrupt or from a newer version', {
          a: deviceFile('a', { tasks: { 1: { item: { id: 1 }, at: 1 } } }),
          bad: { name: 'kandone-bad.json', body: 'not json' },
          newer: { name: 'kandone-newer.json', body: JSON.stringify({ version: 2, device: 'newer' }) },
        }, { items: [{ id: 1 }], deletedIds: [] }],
      ])('returns %s as %j', async (_name, files, expected) => {
        const { sync } = build({ google: fakeGoogle({ files }), storage: signedIn() });

        expect(await sync.loadAllItems('uid', 'tasks')).toEqual(expected);
      });

      it.each([
        ['is rate limited', 429],
        ['fails on the server', 503],
        ['drops the connection mid-download', 'network'],
      ])('fails the whole read when one device\'s file %s, rather than merging without it', async (_name, failure) => {
        const files = {
          a: deviceFile('a', { tasks: { 1: { item: { id: 1 }, at: 1 } } }),
          b: deviceFile('b', { tasks: { 2: { item: null, at: 2 } } }),
        };
        const { sync } = build({ google: fakeGoogle({ files, failRead: { b: failure } }), storage: signedIn() });

        await expect(sync.loadAllItems('uid', 'tasks')).rejects.toBeDefined();
      });

      it('reads every page of the file listing', async () => {
        const files = Object.fromEntries([1, 2, 3].map((n) => [`f${n}`, deviceFile(`d${n}`, { tasks: { [n]: { item: { id: n }, at: 1 } } })]));
        const { sync } = build({ google: fakeGoogle({ files, pageLimit: 2 }), storage: signedIn() });

        expect((await sync.loadAllItems('uid', 'tasks')).items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      });

      it('signs the user out in the header when Google rejects the token', async () => {
        const { sync } = build({ google: fakeGoogle({ failWith: 401 }), storage: signedIn() });
        const seen = [];
        sync.onAuthChange((u) => seen.push(u?.email ?? null));

        await expect(sync.loadAllItems('uid', 'tasks')).rejects.toMatchObject({ status: 401 });
        expect(seen).toEqual([USER.email, null]);
      });
    });

    describe('loadTaskLabels', () => {
      it('round-trips labels saved with saveTaskLabels and is null before any are saved', async () => {
        const { sync } = build({ storage: signedIn() });
        const empty = await sync.loadTaskLabels('uid');

        const saved = sync.saveTaskLabels('uid', [{ id: 'l1', text: 'Home' }]);
        await settle();
        await saved;

        expect([empty, await sync.loadTaskLabels('uid')]).toEqual([null, [{ id: 'l1', text: 'Home' }]]);
      });
    });

    describe('signOut', () => {
      it('drops queued writes and forgets the session', async () => {
        const { sync, storage } = build({ storage: signedIn() });
        const queued = sync.updateItem('uid', 'tasks', { id: 1 });

        await sync.signOut();

        await expect(queued).rejects.toMatchObject({ code: 'signed-out' });
        expect(storage.getItem(SESSION_KEY)).toBeNull();
      });
    });
  });

  describe('formatSignInError', () => {
    it.each([
      [{ code: 'popup_failed_to_open' }, 'Popup blocked. Allow popups for this site, then try again.'],
      [{ code: 'access_denied' }, 'Sign-in cancelled.'],
      [{ code: 'gis-load-failed' }, 'Could not reach Google. Check your connection or ad blocker.'],
      [{ message: 'boom' }, 'boom'],
      [null, 'Sign-in failed.'],
    ])('maps %j', (err, expected) => {
      expect(formatSignInError(err)).toBe(expected);
    });
  });
});
