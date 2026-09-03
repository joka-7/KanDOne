import { afterEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const FULL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, `value-for-${key}`]));

/**
 * Import a fresh copy of firebase.js with `env` stubbed into import.meta.env.
 * The config object is built at module scope, so the module must be re-imported
 * after every env change rather than reused.
 */
async function importWithEnv(env) {
  vi.resetModules();
  for (const key of ENV_KEYS) vi.stubEnv(key, env[key] ?? '');
  return import('../firebase.js');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('firebase.js', () => {
  describe('isCloudConfigured', () => {
    it('is true only when every Firebase variable is set', async () => {
      const cases = [
        ['all six set', FULL_ENV, true],
        ['none set', {}, false],
        ...ENV_KEYS.map((missing) => [
          `${missing} missing`,
          { ...FULL_ENV, [missing]: '' },
          false,
        ]),
      ];

      for (const [name, env, expected] of cases) {
        const { isCloudConfigured } = await importWithEnv(env);

        expect(isCloudConfigured(), name).toBe(expected);
      }
    });
  });

  describe('onAuthChange', () => {
    it('reports signed-out immediately when unconfigured, so callers stop waiting', async () => {
      const { onAuthChange } = await importWithEnv({});
      const callback = vi.fn();

      const unsubscribe = onAuthChange(callback);

      expect(callback).toHaveBeenCalledWith(null);
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('completeRedirectSignIn', () => {
    it('resolves to null when unconfigured rather than loading the SDK', async () => {
      const { completeRedirectSignIn } = await importWithEnv({});

      await expect(completeRedirectSignIn()).resolves.toBeNull();
    });
  });

  describe('signInWithGoogle', () => {
    it('fails with an actionable message when unconfigured', async () => {
      const { signInWithGoogle } = await importWithEnv({});

      await expect(signInWithGoogle()).rejects.toThrow(/VITE_FIREBASE_\*/);
    });
  });
});
