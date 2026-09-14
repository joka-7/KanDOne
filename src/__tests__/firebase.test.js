import { describe, expect, it } from 'vitest';
import { isCloudConfigured, resolveFirebaseConfig } from '../firebase.js';

const ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const FULL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, `value-for-${key}`]));

describe('firebase.js', () => {
  describe('resolveFirebaseConfig', () => {
    it('takes each value from the environment when set and the app default otherwise', () => {
      const cases = [
        ['no env at all falls back to the app project', {}, 'kandone-a6c91'],
        ['an empty override is not a value', { VITE_FIREBASE_PROJECT_ID: '' }, 'kandone-a6c91'],
        ['a set variable wins', { VITE_FIREBASE_PROJECT_ID: 'fork-project' }, 'fork-project'],
      ];

      for (const [name, env, expected] of cases) {
        expect(resolveFirebaseConfig(env).projectId, name).toBe(expected);
      }
    });

    it('overrides each variable independently', () => {
      const resolved = resolveFirebaseConfig(FULL_ENV);

      expect(Object.values(resolved).every((v) => v.startsWith('value-for-VITE_FIREBASE_'))).toBe(true);
    });

    it('leaves no value empty when the environment is empty', () => {
      // Regression: config became env-only, so a deploy that had not set the
      // six variables shipped with isCloudConfigured() false — the header then
      // rendered no "Connect Drive" at all and sync looked deleted.
      expect(Object.values(resolveFirebaseConfig({})).every((v) => v !== '')).toBe(true);
    });
  });

  describe('isCloudConfigured', () => {
    it('is true for a build with no VITE_FIREBASE_* variables set', () => {
      expect(isCloudConfigured()).toBe(true);
    });
  });
});
