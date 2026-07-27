import { describe, it, expect } from 'vitest';
import en from '../locales/en.json';
import he from '../locales/he.json';
import fr from '../locales/fr.json';

/** Flatten nested translation objects into dotted key paths. */
function flattenKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return flattenKeys(value, path);
    }
    return [path];
  });
}

describe('locale key-set parity', () => {
  const enKeys = new Set(flattenKeys(en));
  const heKeys = new Set(flattenKeys(he));
  const frKeys = new Set(flattenKeys(fr));

  it('Hebrew has every English key', () => {
    const missing = [...enKeys].filter((k) => !heKeys.has(k)).sort();
    expect(missing).toEqual([]);
  });

  it('French has every English key', () => {
    const missing = [...enKeys].filter((k) => !frKeys.has(k)).sort();
    expect(missing).toEqual([]);
  });

  it('English has the four task keys that previously drifted out of he/fr', () => {
    for (const key of [
      'tasks.timeline.step',
      'tasks.timeline.stepOverdue',
      'tasks.form.deleteStep',
      'tasks.form.stepDateAfterTask',
    ]) {
      expect(enKeys.has(key)).toBe(true);
      expect(heKeys.has(key)).toBe(true);
      expect(frKeys.has(key)).toBe(true);
    }
  });
});
