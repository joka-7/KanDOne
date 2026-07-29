import { getCollectionName } from './statuses';

const firebaseConfig = {
  apiKey: "AIzaSyAX1AeSD3InSEqZ_bGEyYDfqADssDr1TuQ",
  authDomain: "kandone-a6c91.firebaseapp.com",
  projectId: "kandone-a6c91",
  storageBucket: "kandone-a6c91.firebasestorage.app",
  messagingSenderId: "1072442648740",
  appId: "1:1072442648740:web:dc65116f6cf04a9aca9e31"
};

/**
 * Firebase Auth/Firestore are optional (offline-first app). Keep them out of the
 * initial JS parse by loading the SDK only when a cloud API is first needed.
 */
let firebaseReady = null;

async function ensureFirebase() {
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
}

export async function deleteItem(uid, mode, id) {
  const fb = await ensureFirebase();
  const ref = fb.doc(fb.db, 'users', uid, getCollectionName(mode), String(id));
  await fb.deleteDoc(ref);
}

export async function batchSaveItems(uid, mode, items) {
  if (!items.length) return;
  const fb = await ensureFirebase();
  const CHUNK = 490;
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = fb.writeBatch(fb.db);
    items.slice(i, i + CHUNK).forEach(item => {
      const ref = fb.doc(fb.db, 'users', uid, getCollectionName(mode), String(item.id));
      batch.set(ref, item);
    });
    await batch.commit();
  }
}
