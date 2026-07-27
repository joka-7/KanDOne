import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  browserPopupRedirectResolver, signOut as firebaseSignOut, onAuthStateChanged,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { getCollectionName } from './statuses';

const firebaseConfig = {
  apiKey: "AIzaSyAX1AeSD3InSEqZ_bGEyYDfqADssDr1TuQ",
  authDomain: "kandone-a6c91.firebaseapp.com",
  projectId: "kandone-a6c91",
  storageBucket: "kandone-a6c91.firebasestorage.app",
  messagingSenderId: "1072442648740",
  appId: "1:1072442648740:web:dc65116f6cf04a9aca9e31"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();

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

/** Call once on app load after Google redirect sign-in. */
export async function completeRedirectSignIn() {
  const result = await getRedirectResult(auth);
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
  try {
    const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    return result.user;
  } catch (err) {
    if (shouldFallbackToRedirect(err)) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function loadUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : {};
}

export async function saveUserProfile(uid, data) {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
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

function collectionRef(uid, mode) {
  return collection(db, 'users', uid, getCollectionName(mode));
}

export async function loadAllItems(uid, mode) {
  const colRef = collectionRef(uid, mode);
  const snap = await getDocs(colRef);
  return snap.empty ? null : snap.docs.map(d => d.data());
}

export async function updateItem(uid, mode, item) {
  const ref = doc(db, 'users', uid, getCollectionName(mode), String(item.id));
  await setDoc(ref, item);
}

export async function deleteItem(uid, mode, id) {
  const ref = doc(db, 'users', uid, getCollectionName(mode), String(id));
  await deleteDoc(ref);
}

export async function batchSaveItems(uid, mode, items) {
  if (!items.length) return;
  const CHUNK = 490;
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = writeBatch(db);
    items.slice(i, i + CHUNK).forEach(item => {
      const ref = doc(db, 'users', uid, getCollectionName(mode), String(item.id));
      batch.set(ref, item);
    });
    await batch.commit();
  }
}
