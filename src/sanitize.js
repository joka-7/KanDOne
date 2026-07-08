import { STATUSES_TASKS } from './statuses';

/** Generate a cryptographically random ID (fallback to timestamp if crypto unavailable) */
export function generateId() {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    // Browser environment - use crypto
    const arr = new Uint8Array(12);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  // Fallback: timestamp + random suffix
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function safeStr(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    try { return JSON.stringify(val); } catch { return ''; }
  }
  return String(val);
}

const TASK_STATUS_IDS = new Set(STATUSES_TASKS.map(s => s.id));
const TASK_PRIORITIES = new Set(['high', 'medium', 'low']);
const STEP_STATUSES = new Set(['todo', 'in_progress', 'done', 'blocked']);

function sanitizeInterviews(interviews) {
  if (!Array.isArray(interviews)) return [];
  return interviews.slice(0, 100).map(inv => ({
    type: safeStr(inv.type || inv.round || ''),
    date: safeStr(inv.date || ''),
    interviewer: safeStr(inv.interviewer || ''),
    summary: safeStr(inv.summary || ''),
  }));
}

function sanitizeRejection(rejection) {
  if (!rejection || typeof rejection !== 'object') {
    return { date: '', method: '', notes: '' };
  }
  return {
    date: safeStr(rejection.date || ''),
    method: safeStr(rejection.method || ''),
    notes: safeStr(rejection.notes || ''),
  };
}

/** Whitelist fields for job seeker / recruiter tracker records (import + localStorage). */
export function sanitizeTrackerRecords(importedArray, { unnamedLabel = 'Unnamed' } = {}) {
  if (!Array.isArray(importedArray)) return [];
  return importedArray.slice(0, 10000).map((c) => ({
    id: c.id ? String(c.id).slice(0, 64) : generateId(),
    name: safeStr(c.name || c.company || unnamedLabel),
    role: safeStr(c.role || c.position || ''),
    status: safeStr(c.status || ''),
    location: safeStr(c.location || ''),
    website: safeStr(c.website || ''),
    linkedinCompany: safeStr(c.linkedinCompany || ''),
    linkedinCandidate: safeStr(c.linkedinCandidate || ''),
    description: safeStr(c.description || ''),
    products: safeStr(c.products || ''),
    currentRole: safeStr(c.currentRole || ''),
    expectedSalary: safeStr(c.expectedSalary || ''),
    source: safeStr(c.source || ''),
    generalNotes: safeStr(c.generalNotes || ''),
    priority: safeStr(c.priority || 'medium'),
    interviews: sanitizeInterviews(c.interviews),
    rejection: sanitizeRejection(c.rejection),
  }));
}

/** Parse JSON backup/export into sanitized tracker records, or null if invalid. */
export function parseTrackerImportPayload(raw, { unnamedLabel = 'Unnamed' } = {}) {
  let importedArray = [];
  if (Array.isArray(raw)) {
    importedArray = raw;
  } else if (raw && typeof raw === 'object') {
    const potentialArray = Object.values(raw).find(val => Array.isArray(val));
    importedArray = potentialArray || [raw];
  }
  if (importedArray.length === 0 || importedArray.length > 10000) return null;
  return sanitizeTrackerRecords(importedArray, { unnamedLabel });
}

function sanitizeTaskSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.slice(0, 200).map((s) => ({
    id: s.id ? String(s.id).slice(0, 64) : generateId(),
    title: safeStr(s.title),
    status: STEP_STATUSES.has(s.status) ? s.status : 'todo',
    notes: safeStr(s.notes),
    dueDate: safeStr(s.dueDate),
  }));
}

/** Whitelist fields for tasks mode (import + localStorage). */
export function sanitizeTaskRecords(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 10000).map((t) => ({
    id: t.id ? String(t.id).slice(0, 64) : generateId(),
    name: safeStr(t.name) || 'Unnamed',
    description: safeStr(t.description || ''),
    status: TASK_STATUS_IDS.has(t.status) ? t.status : 'active',
    priority: TASK_PRIORITIES.has(t.priority) ? t.priority : 'medium',
    dueDate: safeStr(t.dueDate || ''),
    steps: sanitizeTaskSteps(t.steps),
    notes: safeStr(t.notes || ''),
  }));
}

export function parseTaskStoragePayload(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return sanitizeTaskRecords(parsed);
  } catch {
    return [];
  }
}
