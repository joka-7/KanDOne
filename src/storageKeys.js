/**
 * Canonical localStorage keys for onboarding/welcome state.
 * Imported by app UI, e2e helpers, and unit tests — keep in sync.
 */
export const STORAGE_KEYS = {
  tasksWelcome: 'hasCompletedOnboarding_tasks',
};

/** Mock AI config for chat e2e (single init script — avoids addInitScript ordering issues). */
export const E2E_AI_STORAGE = {
  aiProvider: 'gemini',
  aiApiKey: 'e2e-test-key',
  aiModel: 'gemini-2.0-flash',
};

/** Required localStorage entries for the tasks e2e init helper (enforced by unit test). */
export const E2E_MODE_INIT = {
  tasks: {
    [STORAGE_KEYS.tasksWelcome]: '1',
    ...E2E_AI_STORAGE,
  },
};
