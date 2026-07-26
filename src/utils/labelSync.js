import { sanitizeTaskLabels, sanitizeTaskRecords } from '../sanitize.js';

/** Pick labels after sign-in: prefer cloud when present, else keep local and push up. */
export function resolveLabelsOnSignIn(localLabels, cloudLabels) {
  const cloud = sanitizeTaskLabels(Array.isArray(cloudLabels) ? cloudLabels : []);
  const local = sanitizeTaskLabels(Array.isArray(localLabels) ? localLabels : []);
  if (cloud.length > 0) return { labels: cloud, pushToCloud: false };
  if (local.length > 0) return { labels: local, pushToCloud: true };
  return { labels: [], pushToCloud: false };
}

/**
 * Pick tasks after sign-in: prefer cloud when present, else keep local and
 * push up. Same first-pass policy as resolveLabelsOnSignIn — not a real
 * per-record merge (no per-task `updatedAt` exists yet to break ties), but it
 * closes the gap where a signed-in user with local-only tasks previously got
 * zero cloud backup because loadAllItems() returning empty was treated as
 * "nothing to do" instead of "push what we have".
 */
export function resolveTasksOnSignIn(localTasks, cloudTasks) {
  const cloud = sanitizeTaskRecords(Array.isArray(cloudTasks) ? cloudTasks : []);
  const local = sanitizeTaskRecords(Array.isArray(localTasks) ? localTasks : []);
  if (cloud.length > 0) return { tasks: cloud, pushToCloud: false };
  if (local.length > 0) return { tasks: local, pushToCloud: true };
  return { tasks: [], pushToCloud: false };
}
