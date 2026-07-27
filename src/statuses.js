export const STATUSES_TASKS = [
  { id: 'active', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'on_hold', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { id: 'completed', color: 'bg-green-100 text-green-800 border-green-200' },
  { id: 'cancelled', color: 'bg-gray-100 text-gray-600 border-gray-200' },
];

export const STEP_STATUSES = ['todo', 'in_progress', 'done', 'blocked'];

export const TASKS_TERMINAL_STATUSES = ['completed', 'cancelled'];

export const getCollectionName = (mode) => {
  if (mode === 'recruiter') return 'candidates';
  if (mode === 'tasks') return 'tasks';
  return 'companies';
};

export const getStorageKey = (mode) =>
  `jobTrackerAppV2Data_${mode}`;

const TASK_ONLY_STATUSES = new Set(['active', 'on_hold', 'completed', 'cancelled']);

/** Whitelist rows against the tasks shape (steps array, task-only statuses). */
export function filterItemsForMode(items, mode) {
  if (!Array.isArray(items)) return [];
  if (mode !== 'tasks') return [];
  return items.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    if (Array.isArray(item.steps)) return true;
    if (Array.isArray(item.interviews) || item.linkedinCompany || item.linkedinCandidate) {
      return false;
    }
    return !item.status || TASK_ONLY_STATUSES.has(item.status);
  });
}
