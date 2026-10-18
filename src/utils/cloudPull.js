import { filterItemsForMode } from '../statuses';
import { resolveLabelsOnSignIn, resolveTasksOnSignIn } from './labelSync';
import { fingerprintItems, diffFingerprints } from './pendingSync';
import { ensureBoardOrders } from './boardOrder';

// Local state is read after the cloud read finishes, never before: a read can
// take seconds (longer right after a reconnect) and people keep typing. A
// snapshot taken up front would not contain what they added meanwhile, and the
// merge would then replace the list with one that lacks it.

/** Merge the cloud's tasks into the local list; returns how many the cloud held. */
export async function pullTasks({ mode, load, getLocal, getPending, apply, save, remove }) {
  const cloud = await load();
  const { tasks: merged, pushIds, deleteFromCloud } = resolveTasksOnSignIn(
    getLocal(), filterItemsForMode(cloud?.items ?? [], mode), getPending(), cloud?.deletedIds,
  );
  const ordered = ensureBoardOrders(merged);
  apply(ordered);
  // Push only what the cloud lacks or has stale: local edits, offline
  // creations, and records whose board order the normalization moved.
  const reordered = diffFingerprints(fingerprintItems(merged), fingerprintItems(ordered)).edited;
  const toPush = new Set([...pushIds, ...reordered]);
  await save(ordered.filter((t) => toPush.has(String(t.id))));
  // Replay deletes made while unsynced, or the next pull resurrects them.
  await Promise.all(deleteFromCloud.map(remove));
  return cloud?.items.length ?? 0;
}

/** Union the cloud's labels with the local ones; returns the merged count. */
export async function pullLabels({ load, getLocal, apply, save }) {
  const cloud = await load();
  const { labels, pushToCloud } = resolveLabelsOnSignIn(getLocal(), cloud);
  apply(labels);
  if (pushToCloud) await save(labels);
  return labels.length;
}
