/**
 * Tracks which locally-changed records have not been confirmed written to the
 * cloud yet, so a later pull can tell "the user edited this while we believed
 * we were offline" apart from "this is just an older copy of a record another
 * device has since changed".
 *
 * Without that distinction a pull had to guess, and it guessed cloud: every
 * record it shared an id with was overwritten. Anything typed during the window
 * before a restorable session resolves (see TasksApp's `authResolved`), or while
 * a write was failing, was destroyed the moment the pull landed.
 *
 * Writes are keyed per collection because a mode's records sync independently.
 */

const STORAGE_PREFIX = 'kandone_pending_sync_v1';

/** Cap the bookkeeping so a runaway local session can't exhaust localStorage. */
const MAX_TRACKED_IDS = 10000;

export function pendingStorageKey(mode) {
  return `${STORAGE_PREFIX}:${mode}`;
}

/** localStorage is unavailable in private modes and blocked-storage browsers. */
function browserStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function toIdSet(ids) {
  if (ids instanceof Set) return ids;
  return new Set(Array.isArray(ids) ? ids.map(String) : []);
}

function capped(ids) {
  return ids.length > MAX_TRACKED_IDS ? ids.slice(-MAX_TRACKED_IDS) : ids;
}

/**
 * Content fingerprint per id. Comparing two of these is how a save detects
 * which records the user actually touched, without every mutation call site
 * having to remember to report itself.
 */
export function fingerprintItems(items, idOf = (item) => item.id) {
  const map = new Map();
  if (!Array.isArray(items)) return map;
  for (const item of items) map.set(String(idOf(item)), JSON.stringify(item));
  return map;
}

/** Ids added or changed, and ids removed, between two fingerprints. */
export function diffFingerprints(before, after) {
  const edited = [];
  for (const [id, hash] of after) {
    if (before.get(id) !== hash) edited.push(id);
  }
  const deleted = [];
  for (const id of before.keys()) {
    if (!after.has(id)) deleted.push(id);
  }
  return { edited, deleted };
}

export function readPending(mode, storage = browserStorage()) {
  const empty = { edited: new Set(), deleted: new Set() };
  if (!storage) return empty;
  try {
    const raw = storage.getItem(pendingStorageKey(mode));
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return { edited: toIdSet(parsed?.edited), deleted: toIdSet(parsed?.deleted) };
  } catch {
    return empty;
  }
}

function writePending(mode, pending, storage) {
  if (!storage) return;
  const edited = capped([...pending.edited]);
  const deleted = capped([...pending.deleted]);
  try {
    if (edited.length === 0 && deleted.length === 0) {
      storage.removeItem(pendingStorageKey(mode));
      return;
    }
    storage.setItem(pendingStorageKey(mode), JSON.stringify({ edited, deleted }));
  } catch {
    // Storage full or blocked. The pull then falls back to preferring cloud for
    // shared ids, which is the pre-existing behaviour — degraded, not broken.
  }
}

/**
 * Fold one save's changes into the pending set. An id is only ever in one of
 * the two sets: re-creating a deleted id makes it an edit again, and deleting
 * an edited id makes it a delete.
 */
export function recordLocalChanges(mode, { edited = [], deleted = [] }, storage = browserStorage()) {
  if (edited.length === 0 && deleted.length === 0) return;
  const pending = readPending(mode, storage);
  for (const id of edited) {
    pending.deleted.delete(String(id));
    pending.edited.add(String(id));
  }
  for (const id of deleted) {
    pending.edited.delete(String(id));
    pending.deleted.add(String(id));
  }
  writePending(mode, pending, storage);
}

/** Drop ids whose cloud write has actually landed — they are no longer at risk. */
export function clearPendingIds(mode, ids, storage = browserStorage()) {
  if (!ids || ids.length === 0) return;
  const pending = readPending(mode, storage);
  let changed = false;
  for (const id of ids) {
    const key = String(id);
    if (pending.edited.delete(key)) changed = true;
    if (pending.deleted.delete(key)) changed = true;
  }
  if (changed) writePending(mode, pending, storage);
}
