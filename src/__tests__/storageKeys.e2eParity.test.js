import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { E2E_MODE_INIT, STORAGE_KEYS } from '../storageKeys.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('E2E storage key parity', () => {
  it('tasks e2e helper uses the KanDOne welcome key', () => {
    const helpers = readFileSync(join(root, 'e2e/helpers.js'), 'utf8');
    expect(helpers).toContain(STORAGE_KEYS.tasksWelcome);
  });

  it('initTasksApp seeds E2E_MODE_INIT.tasks welcome and AI keys', () => {
    const helpers = readFileSync(join(root, 'e2e/helpers.js'), 'utf8');
    const expected = E2E_MODE_INIT.tasks;
    expect(helpers).toContain(`localStorage.setItem('${STORAGE_KEYS.tasksWelcome}', '1')`);
    expect(helpers).toContain('E2E_AI_STORAGE');
    expect(expected[STORAGE_KEYS.tasksWelcome]).toBe('1');
    expect(expected.aiApiKey).toBe('e2e-test-key');
  });
});
