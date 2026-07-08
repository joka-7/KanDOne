export const STATUSES_JOBSEEKER = [
  { id: 'applied', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'hr_call', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'tech_interview', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { id: 'manager_interview', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { id: 'home_assignment', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { id: 'references', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  { id: 'offer', color: 'bg-green-100 text-green-800 border-green-200' },
  { id: 'frozen', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  { id: 'rejected', color: 'bg-red-100 text-red-800 border-red-200' },
  { id: 'ghosted', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { id: 'withdrawn', color: 'bg-stone-100 text-stone-700 border-stone-300' },
];

export const STATUSES_RECRUITER = [
  { id: 'applied', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'screening', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'phone_screen', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { id: 'technical', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { id: 'final_interview', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { id: 'offer_extended', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  { id: 'offer_accepted', color: 'bg-green-100 text-green-800 border-green-200' },
  { id: 'rejected', color: 'bg-red-100 text-red-800 border-red-200' },
  { id: 'withdrawn', color: 'bg-stone-100 text-stone-700 border-stone-300' },
];

export const getStatuses = (mode) =>
  mode === 'recruiter' ? STATUSES_RECRUITER : STATUSES_JOBSEEKER;

export const JOBSEEKER_TERMINAL_STATUSES = ['rejected', 'ghosted', 'withdrawn', 'offer'];
export const RECRUITER_TERMINAL_STATUSES = ['rejected', 'withdrawn', 'offer_accepted'];

export const getTerminalStatuses = (mode) =>
  mode === 'recruiter' ? RECRUITER_TERMINAL_STATUSES : JOBSEEKER_TERMINAL_STATUSES;

export const getRejectedStatuses = (mode) =>
  mode === 'recruiter' ? ['rejected'] : ['rejected', 'ghosted'];

export const INTERVIEW_TYPE_KEYS = [
  'Intro Call / HR',
  'Technical Interview',
  'Manager Interview',
  'Home Assignment / Task',
  'VP / CEO Interview',
  'References Check',
  'Salary Offer',
  'Other',
];

export const RECRUITER_FUNNEL_ORDER = [
  'applied', 'screening', 'phone_screen', 'technical', 'offer_extended',
];

export const JOBSEEKER_FUNNEL_ORDER = [
  'applied', 'hr_call', 'tech_interview', 'manager_interview', 'offer',
];

export const getFunnelOrder = (mode) =>
  mode === 'recruiter' ? RECRUITER_FUNNEL_ORDER : JOBSEEKER_FUNNEL_ORDER;

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

const JOBSEEKER_ONLY_STATUSES = new Set([
  'hr_call', 'tech_interview', 'manager_interview', 'home_assignment',
  'references', 'frozen', 'ghosted', 'offer',
]);

const RECRUITER_ONLY_STATUSES = new Set([
  'screening', 'phone_screen', 'technical', 'final_interview',
  'offer_extended', 'offer_accepted',
]);

const TASK_ONLY_STATUSES = new Set(['active', 'on_hold', 'completed', 'cancelled']);

const SHARED_PIPELINE_STATUSES = new Set(['applied', 'rejected', 'withdrawn']);

const looksLikeRecruiterRecord = (item) => Boolean(
  item.linkedinCandidate || item.source || item.expectedSalary || item.currentRole,
);

const looksLikeJobseekerRecord = (item) => Boolean(
  item.linkedinCompany || item.website || item.description || item.products ||
  item.linkedinHR || (Array.isArray(item.homeworks) && item.homeworks.length > 0),
);

/** Hide job-search rows that bled into recruiter storage (e.g. shared "applied" status). */
export function filterItemsForMode(items, mode) {
  if (!Array.isArray(items)) return [];

  if (mode === 'tasks') {
    return items.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      if (Array.isArray(item.steps)) return true;
      if (Array.isArray(item.interviews) || item.linkedinCompany || item.linkedinCandidate) {
        return false;
      }
      return !item.status || TASK_ONLY_STATUSES.has(item.status);
    });
  }

  return items.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const status = item.status;
    const jobseekerShape = looksLikeJobseekerRecord(item);
    const recruiterShape = looksLikeRecruiterRecord(item);

    if (mode === 'recruiter') {
      if (JOBSEEKER_ONLY_STATUSES.has(status)) return false;
      if (jobseekerShape && !recruiterShape) return false;
      if (RECRUITER_ONLY_STATUSES.has(status)) return true;
      // applied / rejected / withdrawn exist in both modes — require recruiter fields
      if (SHARED_PIPELINE_STATUSES.has(status)) return recruiterShape;
      return recruiterShape;
    }

    if (RECRUITER_ONLY_STATUSES.has(status)) return false;
    if (recruiterShape && !jobseekerShape) return false;
    if (JOBSEEKER_ONLY_STATUSES.has(status)) return true;
    if (SHARED_PIPELINE_STATUSES.has(status)) return jobseekerShape || !recruiterShape;
    return jobseekerShape || !recruiterShape;
  });
}

export function resolveInitialAppMode() {
  const stored = localStorage.getItem('appMode');
  if (stored === 'jobseeker' || stored === 'recruiter' || stored === 'tasks') return stored;

  const legacyKeys = ['jobTrackerAppV2Data', 'jobTrackerV3Data', 'jobTrackerData'];
  for (const key of legacyKeys) {
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localStorage.setItem('appMode', 'jobseeker');
          if (!localStorage.getItem(getStorageKey('jobseeker'))) {
            localStorage.setItem(getStorageKey('jobseeker'), saved);
          }
          return 'jobseeker';
        }
      } catch { /* ignore */ }
    }
  }
  return null;
}
