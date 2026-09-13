import { sanitizeTaskLabels, sanitizeTaskRecords } from '../sanitize.js';

/**
 * Union-merge by id. Cloud is authoritative by default, with two exceptions the
 * local side owns, both drawn from `pending` (see ./pendingSync) — the set of
 * records whose local change has not been confirmed written to the cloud:
 *
 * - a record with a pending local edit keeps the local copy and is pushed up,
 *   because the pull's copy predates work the user can see on screen;
 * - a record with a pending local delete is dropped from the pull rather than
 *   resurrected, and the delete is reported so it can be replayed upstream.
 *
 * A record the cloud has never seen at all is kept regardless — it was created
 * while offline, or while the UI hadn't yet heard back from Firebase about a
 * signed-in session.
 *
 * Two rules were wrong before this. Returning an empty `local` set destroyed
 * offline-created records outright; then cloud-wins-on-a-shared-id destroyed
 * offline *edits* to existing records, which is subtler and was the one users
 * actually hit — a task they had just typed into reverted on reconnect. With
 * `pending` empty the result matches that old cloud-wins rule exactly, so a
 * storage-blocked browser degrades to the previous behaviour.
 */
function unionById(cloud, local, idOf, pending) {
  const editedLocally = pending?.edited ?? new Set();
  const deletedLocally = pending?.deleted ?? new Set();

  const deleteFromCloud = [];
  const survivingCloud = [];
  for (const item of cloud) {
    const id = String(idOf(item));
    if (deletedLocally.has(id)) deleteFromCloud.push(id);
    else survivingCloud.push(item);
  }

  const unmatchedLocal = new Map(local.map((item) => [String(idOf(item)), item]));
  let keptLocalEdit = false;
  const merged = survivingCloud.map((cloudItem) => {
    const id = String(idOf(cloudItem));
    const localItem = unmatchedLocal.get(id);
    unmatchedLocal.delete(id);
    if (localItem && editedLocally.has(id)) {
      keptLocalEdit = true;
      return localItem;
    }
    return cloudItem;
  });

  const localOnly = [...unmatchedLocal.values()];
  return {
    merged: [...merged, ...localOnly],
    pushToCloud: keptLocalEdit || localOnly.length > 0,
    deleteFromCloud,
  };
}

/** Pick labels after sign-in/reconnect: union by id, cloud wins on a shared id. */
export function resolveLabelsOnSignIn(localLabels, cloudLabels) {
  const cloud = sanitizeTaskLabels(Array.isArray(cloudLabels) ? cloudLabels : []);
  const local = sanitizeTaskLabels(Array.isArray(localLabels) ? localLabels : []);
  const { merged, pushToCloud } = unionById(cloud, local, (l) => l.id);
  return { labels: merged, pushToCloud };
}

/**
 * Pick tasks after sign-in/reconnect. Cloud wins on a shared id unless `pending`
 * says the local copy is still waiting to reach the cloud.
 */
export function resolveTasksOnSignIn(localTasks, cloudTasks, pending) {
  const cloud = sanitizeTaskRecords(Array.isArray(cloudTasks) ? cloudTasks : []);
  const local = sanitizeTaskRecords(Array.isArray(localTasks) ? localTasks : []);
  const { merged, pushToCloud, deleteFromCloud } = unionById(cloud, local, (t) => t.id, pending);
  return { tasks: merged, pushToCloud, deleteFromCloud };
}
