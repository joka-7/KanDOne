import { getCollectionName } from './statuses';
import { clearPendingIds } from './utils/pendingSync';

// Firebase web config is a public client identifier, not a secret — it ships in
// the client bundle by design. Access is controlled by firestore.rules and by
// Authentication → Authorized domains, not by hiding these values.
//
// VITE_FIREBASE_* wins where it is set, so a fork or preview deploy can point
// at its own project. The app's own project is the fallback: making config
// env-only meant a deploy that had not set the six variables silently shipped
// with cloud sync switched off and no "Connect Drive" button at all, which is
// indistinguishable from the feature having been removed.
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAX1AeSD3InSEqZ_bGEyYDfqADssDr1TuQ',
  authDomain: 'kandone-a6c91.firebaseapp.com',
  projectId: 'kandone-a6c91',
  storageBucket: 'kandone-a6c91.firebasestorage.app',
  messagingSenderId: '1072442648740',
  appId: '1:1072442648740:web:dc65116f6cf04a9aca9e31',
};

/** Per-value precedence: a set VITE_FIREBASE_* variable, else the app's project. */
export function resolveFirebaseConfig(env = import.meta.env) {
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
    projectId: env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    appId: env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
  };
}

const firebaseConfig = resolveFirebaseConfig();

/**
 * True when every Firebase value needed to sign in and sync is present.
 *
 * With the fallback above this only goes false if someone strips the defaults
 * or overrides a variable with an empty string, but the checks that depend on
 * it stay — an unconfigured build must still degrade to local-only rather than
 * boot an SDK that cannot authenticate.
 */
export function isCloudConfigured() {
  return Object.values(firebaseConfig).every((value) => value !== '');
}

/**
 * Firebase Auth/Firestore are optional (offline-first app). Keep them out of the
 * initial JS parse by loading the SDK only when a cloud API is first needed.
 */
let firebaseReady = null;

async function ensureFirebase() {
  if (!isCloudConfigured()) {
    throw new Error(
      'Firebase is not configured. Set the VITE_FIREBASE_* variables (see .env.example).',
    );
  }
  if (!firebaseReady) {
    firebaseReady = (async () => {
      const { initializeApp } = await import('firebase/app');
      const {
        getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
        browserPopupRedirectResolver, signOut: firebaseSignOut, onAuthStateChanged,
      } = await import('firebase/auth');
      const {
        initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
        doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch,
      } = await import('firebase/firestore');

      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      // Persistent IndexedDB cache: queues writes made while offline and replays
      // them on reconnect, and serves reads from cache instead of failing outright.
      const db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
      const provider = new GoogleAuthProvider();

      return {
        auth, db, provider,
        signInWithPopup, signInWithRedirect, getRedirectResult,
        browserPopupRedirectResolver, firebaseSignOut, onAuthStateChanged,
        doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch,
      };
    })();
  }
  return firebaseReady;
}

// Firebase Auth persists the signed-in user in this IndexedDB store. Detecting
// it without loading the SDK is what lets the header tell "returning user whose
// session is still being confirmed" apart from "signed out", so a slow or
// blocked SDK bootstrap never shows a false "Connect Drive" that invites the
// user to start working as if their data were local-only.
const FIREBASE_AUTH_DB = 'firebaseLocalStorageDb';
const FIREBASE_AUTH_STORE = 'firebaseLocalStorage';

// Opens the auth DB and resolves true iff it holds a persisted firebase:authUser
// entry. If the DB didn't exist (oldVersion 0), opening creates an empty one —
// we detect that and delete it so fresh visitors aren't left with a phantom DB.
function probePersistedAuthUser() {
  return new Promise((resolve) => {
    let req;
    try { req = window.indexedDB.open(FIREBASE_AUTH_DB); }
    catch { return resolve(false); }
    let created = false;
    req.onupgradeneeded = (e) => { if (e.oldVersion === 0) created = true; };
    req.onerror = () => resolve(false);
    req.onsuccess = () => {
      const db = req.result;
      if (created || !db.objectStoreNames.contains(FIREBASE_AUTH_STORE)) {
        db.close();
        if (created) { try { window.indexedDB.deleteDatabase(FIREBASE_AUTH_DB); } catch { /* ignore */ } }
        return resolve(false);
      }
      try {
        const keysReq = db.transaction(FIREBASE_AUTH_STORE, 'readonly')
          .objectStore(FIREBASE_AUTH_STORE).getAllKeys();
        keysReq.onsuccess = () => {
          const has = (keysReq.result || []).some((k) => String(k).startsWith('firebase:authUser:'));
          db.close();
          resolve(has);
        };
        keysReq.onerror = () => { db.close(); resolve(false); };
      } catch { db.close(); resolve(false); }
    };
  });
}

/**
 * True when a previously signed-in session should be restored on load. Where
 * indexedDB.databases() exists (Chromium/WebKit) we use it to skip the probe for
 * fresh visitors; where it doesn't (Firefox) we probe directly, which self-cleans
 * any empty DB it has to create. Either way the Firebase SDK is never loaded here.
 */
export async function hasRestorableSession() {
  if (!isCloudConfigured()) return false;
  try {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') return false;
    if (window.indexedDB.databases) {
      const dbs = await window.indexedDB.databases();
      if (!dbs.some((d) => d.name === FIREBASE_AUTH_DB)) return false;
    }
    return await probePersistedAuthUser();
  } catch { return false; }
}

/** True when Firebase Auth may have a redirect result waiting to be consumed. */
function hasPendingAuthRedirect() {
  try {
    return Object.keys(sessionStorage).some(
      (k) => k.startsWith('firebase:') && /redirect/i.test(k),
    );
  } catch {
    // sessionStorage blocked — load the SDK so we don't drop a real redirect.
    return true;
  }
}

/** User-facing message for Firebase Google sign-in failures (header "Connect Drive"). */
export function formatSignInError(err) {
  const code = err?.code || '';
  const msg = err?.message || '';
  if (code === 'auth/popup-blocked') {
    return 'Popup blocked. Allow popups for this site, then try again.';
  }
  if (code === 'auth/popup-closed-by-user') return 'Sign-in cancelled.';
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return host
      ? `Add "${host}" in Firebase → Authentication → Settings → Authorized domains.`
      : 'This site is not in Firebase Authentication → Authorized domains.';
  }
  if (/referrer|API key|API_KEY/i.test(msg)) {
    return 'Google API key blocked this site. In Cloud Console set Browser key → Application restrictions to None.';
  }
  if (/requested action is invalid/i.test(msg)) {
    return 'Google sign-in config error. Check Firebase Authorized domains and API key restrictions.';
  }
  return msg || 'Sign-in failed.';
}

/** Call once on app load after Google redirect sign-in. No-ops if nothing pending. */
export async function completeRedirectSignIn() {
  if (!isCloudConfigured()) return null;
  if (!hasPendingAuthRedirect()) return null;
  const fb = await ensureFirebase();
  const result = await fb.getRedirectResult(fb.auth);
  return result?.user ?? null;
}

function shouldFallbackToRedirect(err) {
  const code = err?.code || '';
  const msg = err?.message || '';
  return code === 'auth/popup-blocked'
    || code === 'auth/popup-closed-by-user'
    || code === 'auth/internal-error'
    || /requested action is invalid/i.test(msg)
    || /not authorized|auth site/i.test(msg);
}

export async function signInWithGoogle() {
  const fb = await ensureFirebase();
  try {
    const result = await fb.signInWithPopup(fb.auth, fb.provider, fb.browserPopupRedirectResolver);
    return result.user;
  } catch (err) {
    if (shouldFallbackToRedirect(err)) {
      await fb.signInWithRedirect(fb.auth, fb.provider);
      return null;
    }
    throw err;
  }
}

export async function signOut() {
  const fb = await ensureFirebase();
  await fb.firebaseSignOut(fb.auth);
}

/**
 * Subscribe to auth state. Returns an unsubscribe that is safe to call before
 * the SDK has finished loading (no-op until the real listener is attached).
 */
export function onAuthChange(callback) {
  if (!isCloudConfigured()) {
    // Report "signed out" so callers stop waiting on a session that can never
    // arrive — otherwise the header sits on "Checking…" forever.
    callback(null);
    return () => {};
  }
  let unsub = () => {};
  let cancelled = false;
  ensureFirebase().then((fb) => {
    if (cancelled) return;
    unsub = fb.onAuthStateChanged(fb.auth, callback);
  }).catch((err) => {
    console.error('Failed to initialize Firebase auth listener', err);
  });
  return () => {
    cancelled = true;
    unsub();
  };
}

export async function loadUserProfile(uid) {
  const fb = await ensureFirebase();
  const snap = await fb.getDoc(fb.doc(fb.db, 'users', uid));
  return snap.exists() ? snap.data() : {};
}

export async function saveUserProfile(uid, data) {
  const fb = await ensureFirebase();
  await fb.setDoc(fb.doc(fb.db, 'users', uid), data, { merge: true });
}

/** Load the task label library stored on the user profile (`tasksLabels` field). */
export async function loadTaskLabels(uid) {
  const profile = await loadUserProfile(uid);
  if (!Array.isArray(profile.tasksLabels)) return null;
  return profile.tasksLabels;
}

/** Persist the task label library to the user profile for cross-device sync. */
export async function saveTaskLabels(uid, labels) {
  await saveUserProfile(uid, { tasksLabels: labels, appMode: 'tasks' });
}

export async function loadAllItems(uid, mode) {
  const fb = await ensureFirebase();
  const colRef = fb.collection(fb.db, 'users', uid, getCollectionName(mode));
  const snap = await fb.getDocs(colRef);
  return snap.empty ? null : snap.docs.map(d => d.data());
}

export async function updateItem(uid, mode, item) {
  const fb = await ensureFirebase();
  const ref = fb.doc(fb.db, 'users', uid, getCollectionName(mode), String(item.id));
  await fb.setDoc(ref, item);
  // Only once the write has actually landed does this record stop needing to
  // win over a cloud pull (see ./utils/pendingSync).
  clearPendingIds(mode, [item.id]);
}

export async function deleteItem(uid, mode, id) {
  const fb = await ensureFirebase();
  const ref = fb.doc(fb.db, 'users', uid, getCollectionName(mode), String(id));
  await fb.deleteDoc(ref);
  clearPendingIds(mode, [id]);
}

export async function batchSaveItems(uid, mode, items) {
  if (!items.length) return;
  const fb = await ensureFirebase();
  const CHUNK = 490;
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = fb.writeBatch(fb.db);
    const chunk = items.slice(i, i + CHUNK);
    chunk.forEach(item => {
      const ref = fb.doc(fb.db, 'users', uid, getCollectionName(mode), String(item.id));
      batch.set(ref, item);
    });
    await batch.commit();
    clearPendingIds(mode, chunk.map(item => item.id));
  }
}
