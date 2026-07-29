/** Spacing between assigned boardOrder values (leaves room for inserts). */
export const BOARD_ORDER_GAP = 1000;

/** Accept a finite number; otherwise treat as missing. */
export function sanitizeBoardOrder(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Stable sort for cards inside one column. */
export function sortByBoardOrder(tasks) {
  return [...tasks].sort((a, b) => {
    const ao = sanitizeBoardOrder(a?.boardOrder);
    const bo = sanitizeBoardOrder(b?.boardOrder);
    if (ao !== null && bo !== null && ao !== bo) return ao - bo;
    if (ao !== null && bo === null) return -1;
    if (ao === null && bo !== null) return 1;
    return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
  });
}

/**
 * Assign boardOrder per status so every task has a finite value.
 * Preserves existing relative order when possible; otherwise uses array order.
 */
export function ensureBoardOrders(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return Array.isArray(tasks) ? tasks : [];

  const byStatus = new Map();
  tasks.forEach((t, index) => {
    const status = t?.status || 'active';
    if (!byStatus.has(status)) byStatus.set(status, []);
    byStatus.get(status).push({ t, index });
  });

  const orderById = new Map();
  for (const group of byStatus.values()) {
    group.sort((a, b) => {
      const ao = sanitizeBoardOrder(a.t.boardOrder);
      const bo = sanitizeBoardOrder(b.t.boardOrder);
      if (ao !== null && bo !== null && ao !== bo) return ao - bo;
      if (ao !== null && bo === null) return -1;
      if (ao === null && bo !== null) return 1;
      return a.index - b.index;
    });
    group.forEach(({ t }, idx) => {
      orderById.set(t.id, idx * BOARD_ORDER_GAP);
    });
  }

  return tasks.map((t) => ({
    ...t,
    boardOrder: orderById.has(t.id) ? orderById.get(t.id) : 0,
  }));
}

/** Next order at the end of a column (after max existing). */
export function nextBoardOrder(columnTasks) {
  const sorted = sortByBoardOrder(columnTasks || []);
  if (sorted.length === 0) return 0;
  const max = sorted.reduce((m, t) => {
    const o = sanitizeBoardOrder(t.boardOrder);
    return o !== null && o > m ? o : m;
  }, Number.NEGATIVE_INFINITY);
  return Number.isFinite(max) ? max + BOARD_ORDER_GAP : 0;
}

function reindexIds(tasks, orderedIds) {
  const orderMap = new Map(orderedIds.map((id, i) => [String(id), i * BOARD_ORDER_GAP]));
  return tasks.map((t) => (
    orderMap.has(String(t.id)) ? { ...t, boardOrder: orderMap.get(String(t.id)) } : t
  ));
}

/**
 * Apply a board drag: reorder within a column or move across columns.
 *
 * @param {object[]} tasks
 * @param {{ activeId: string, overId: string|null, toStatus: string, applyStatusChange: Function }} args
 * @returns {{ tasks: object[], changed: boolean, movedTask: object|null }}
 */
export function applyBoardDrag(tasks, { activeId, overId, toStatus, applyStatusChange }) {
  if (!activeId || !toStatus || !Array.isArray(tasks)) {
    return { tasks, changed: false, movedTask: null };
  }

  const active = tasks.find((t) => String(t.id) === String(activeId));
  if (!active) return { tasks, changed: false, movedTask: null };

  const fromStatus = active.status;
  const applyChange = typeof applyStatusChange === 'function'
    ? applyStatusChange
    : (task, status) => ({ ...task, status });

  // Build destination column id list (without the dragged card), then insert.
  const destSorted = sortByBoardOrder(
    tasks.filter((t) => t.status === toStatus && String(t.id) !== String(activeId)),
  );
  let destIds = destSorted.map((t) => String(t.id));

  const overIsCard = overId && destIds.includes(String(overId));
  const overIsSelf = overId && String(overId) === String(activeId);

  if (overIsCard) {
    const at = destIds.indexOf(String(overId));
    destIds = [...destIds.slice(0, at), String(activeId), ...destIds.slice(at)];
  } else if (!overIsSelf) {
    // Dropped on column (or empty area) → append.
    destIds = [...destIds, String(activeId)];
  } else if (fromStatus === toStatus) {
    // No meaningful target — keep previous order.
    return { tasks, changed: false, movedTask: null };
  } else {
    destIds = [...destIds, String(activeId)];
  }

  // Same-column reorder with identical sequence → no-op.
  if (fromStatus === toStatus) {
    const prevIds = sortByBoardOrder(tasks.filter((t) => t.status === fromStatus))
      .map((t) => String(t.id));
    if (prevIds.length === destIds.length && prevIds.every((id, i) => id === destIds[i])) {
      return { tasks, changed: false, movedTask: null };
    }
  }

  let next = tasks.map((t) => {
    if (String(t.id) !== String(activeId)) return t;
    if (fromStatus === toStatus) return t;
    return applyChange(t, toStatus);
  });

  next = reindexIds(next, destIds);

  // Reindex source column after a cross-column move so gaps stay tidy.
  if (fromStatus !== toStatus) {
    const sourceIds = sortByBoardOrder(
      next.filter((t) => t.status === fromStatus),
    ).map((t) => String(t.id));
    next = reindexIds(next, sourceIds);
  }

  const movedTask = next.find((t) => String(t.id) === String(activeId)) || null;
  return { tasks: next, changed: true, movedTask };
}
