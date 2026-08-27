import { sanitizeTaskLabels, sanitizeTaskRecords } from '../sanitize.js';

/**
 * Union-merge by id: cloud is authoritative for any record it already has
 * (no per-record `updatedAt` exists yet to arbitrate a real conflict), but a
 * local record whose id isn't in the cloud at all — created while offline, or
 * while the UI hadn't yet heard back from Firebase about a signed-in session —
 * is kept rather than silently dropped. Returning an empty `local` set (the
 * old "cloud always wins outright" rule) meant any such record was destroyed
 * the moment the cloud pull landed and overwrote localStorage.
 */
function unionById(cloud, local, idOf) {
  if (cloud.length === 0) {
    return local.length > 0 ? { merged: local, pushToCloud: true } : { merged: [], pushToCloud: false };
  }
  const cloudIds = new Set(cloud.map(idOf));
  const localOnly = local.filter((item) => !cloudIds.has(idOf(item)));
  if (localOnly.length === 0) return { merged: cloud, pushToCloud: false };
  return { merged: [...cloud, ...localOnly], pushToCloud: true };
}

/** Pick labels after sign-in/reconnect: union by id, cloud wins on a shared id. */
export function resolveLabelsOnSignIn(localLabels, cloudLabels) {
  const cloud = sanitizeTaskLabels(Array.isArray(cloudLabels) ? cloudLabels : []);
  const local = sanitizeTaskLabels(Array.isArray(localLabels) ? localLabels : []);
  const { merged, pushToCloud } = unionById(cloud, local, (l) => l.id);
  return { labels: merged, pushToCloud };
}

/** Pick tasks after sign-in/reconnect: union by id, cloud wins on a shared id. */
export function resolveTasksOnSignIn(localTasks, cloudTasks) {
  const cloud = sanitizeTaskRecords(Array.isArray(cloudTasks) ? cloudTasks : []);
  const local = sanitizeTaskRecords(Array.isArray(localTasks) ? localTasks : []);
  const { merged, pushToCloud } = unionById(cloud, local, (t) => t.id);
  return { tasks: merged, pushToCloud };
}
