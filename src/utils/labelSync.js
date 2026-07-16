import { sanitizeTaskLabels } from '../sanitize.js';

/** Pick labels after sign-in: prefer cloud when present, else keep local and push up. */
export function resolveLabelsOnSignIn(localLabels, cloudLabels) {
  const cloud = sanitizeTaskLabels(Array.isArray(cloudLabels) ? cloudLabels : []);
  const local = sanitizeTaskLabels(Array.isArray(localLabels) ? localLabels : []);
  if (cloud.length > 0) return { labels: cloud, pushToCloud: false };
  if (local.length > 0) return { labels: local, pushToCloud: true };
  return { labels: [], pushToCloud: false };
}
