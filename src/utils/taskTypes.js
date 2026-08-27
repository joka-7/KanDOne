import {
  Wrench, ShoppingCart, Package, CalendarClock, Trash,
  Phone, Mail, Brush, BookOpen, HelpCircle,
} from 'lucide-react';

/**
 * Fixed action-verb taxonomy for "what kind of task is this" — deliberately
 * distinct from labels (freeform, user-named tags with their own colors).
 * A small closed set means every task is groupable/sortable by kind without
 * everyone having to agree on their own label names for the same handful of
 * everyday actions.
 *
 * `type: ''` means "no type set" — kept apart from `'other'`, which is a
 * deliberate "I looked, and it's something else" choice.
 */
export const TASK_TYPES = [
  'fix', 'buy', 'order', 'arrange', 'throw',
  'call', 'email', 'clean', 'research', 'other',
];

/** Icon per type. Kept here (not in a component file) so every consumer —
 * form picker, board/list badges, the dedicated Type tab — draws from one
 * map without tripping react-refresh's "component files export only
 * components" rule. */
export const TYPE_ICONS = {
  fix: Wrench,
  buy: ShoppingCart,
  order: Package,
  arrange: CalendarClock,
  throw: Trash,
  call: Phone,
  email: Mail,
  clean: Brush,
  research: BookOpen,
  other: HelpCircle,
};

const TYPE_STYLES = {
  fix: 'bg-orange-100 text-orange-700 border-orange-200',
  buy: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  order: 'bg-blue-100 text-blue-700 border-blue-200',
  arrange: 'bg-violet-100 text-violet-700 border-violet-200',
  throw: 'bg-stone-100 text-stone-700 border-stone-200',
  call: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  email: 'bg-sky-100 text-sky-700 border-sky-200',
  clean: 'bg-teal-100 text-teal-700 border-teal-200',
  research: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  other: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const getTypeStyle = (type) => TYPE_STYLES[type] || TYPE_STYLES.other;

/** The bucket id used for tasks with no type set — sorts/groups last. */
export const UNTYPED = 'untyped';

/** All group ids in display order: every real type, then the untyped bucket. */
export const TYPE_GROUPS = [...TASK_TYPES, UNTYPED];

/** The type a task actually belongs to, defaulting unknown/missing to UNTYPED. */
export function resolveTaskType(task) {
  return TASK_TYPES.includes(task?.type) ? task.type : UNTYPED;
}

/** Bucket tasks by type; every id in TYPE_GROUPS is present, empty arrays included. */
export function groupTasksByType(tasks) {
  const groups = Object.fromEntries(TYPE_GROUPS.map((id) => [id, []]));
  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    groups[resolveTaskType(task)].push(task);
  });
  return groups;
}

/** Sort tasks so same-type tasks cluster together, in TYPE_GROUPS order. */
export function sortByType(tasks) {
  const rank = (task) => TYPE_GROUPS.indexOf(resolveTaskType(task));
  return [...(tasks || [])].sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
  });
}
