import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  safeStr, generateId, sanitizeTaskRecords, parseTaskStoragePayload,
  sanitizeTaskLabels, parseTaskLabelsStoragePayload,
} from '../sanitize';

describe('safeStr', () => {
  it('returns empty string for nullish values', () => {
    expect(safeStr(null)).toBe('');
    expect(safeStr(undefined)).toBe('');
  });

  it('passes strings through', () => {
    expect(safeStr('hello')).toBe('hello');
  });

  it('stringifies primitives', () => {
    expect(safeStr(42)).toBe('42');
    expect(safeStr(true)).toBe('true');
  });

  it('JSON-stringifies plain objects', () => {
    expect(safeStr({ a: 1 })).toBe('{"a":1}');
  });
});

describe('generateId', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns a hex string from crypto.getRandomValues when available', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (arr) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i;
        return arr;
      },
    });
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]+$/);
    expect(id.length).toBe(24);
  });
});

describe('sanitizeTaskRecords', () => {
  it('returns [] for non-arrays', () => {
    expect(sanitizeTaskRecords(null)).toEqual([]);
    expect(sanitizeTaskRecords({})).toEqual([]);
  });

  it('whitelists known fields and defaults hostile/missing values', () => {
    const [task] = sanitizeTaskRecords([{
      id: '<script>x</script>',
      name: null,
      status: 'hacker_status',
      priority: 'urgent',
      description: { nested: true },
      steps: 'not-an-array',
      labelIds: [1, 2, 'ok'],
      cardColor: 'red',
      dueTime: '99:99',
      __proto__: { polluted: true },
      evil: 'drop me',
    }]);

    expect(task.name).toBe('Unnamed');
    expect(task.status).toBe('active');
    expect(task.priority).toBe('medium');
    expect(task.description).toContain('nested');
    expect(task.steps).toEqual([]);
    expect(task.labelIds).toEqual(['1', '2', 'ok']);
    expect(task.cardColor).toBe('');
    expect(task.dueTime).toBe('');
    expect(task).not.toHaveProperty('evil');
    expect(task.id.length).toBeLessThanOrEqual(64);
  });

  it('keeps valid step statuses and drops unknown ones to todo', () => {
    const [task] = sanitizeTaskRecords([{
      name: 'X',
      steps: [
        { id: '1', title: 'A', status: 'done' },
        { id: '2', title: 'B', status: 'bogus' },
      ],
    }]);
    expect(task.steps[0].status).toBe('done');
    expect(task.steps[1].status).toBe('todo');
  });

  it('caps the number of imported tasks', () => {
    const rows = Array.from({ length: 10005 }, (_, i) => ({ name: `T${i}` }));
    expect(sanitizeTaskRecords(rows)).toHaveLength(10000);
  });
});

describe('parseTaskStoragePayload', () => {
  it('returns [] for empty, invalid JSON, or non-array payloads', () => {
    expect(parseTaskStoragePayload(null)).toEqual([]);
    expect(parseTaskStoragePayload('not-json')).toEqual([]);
    expect(parseTaskStoragePayload('{"tasks":[]}')).toEqual([]);
  });

  it('parses a JSON array of tasks', () => {
    const raw = JSON.stringify([{ name: 'Ship', status: 'active' }]);
    const tasks = parseTaskStoragePayload(raw);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('Ship');
  });
});

describe('sanitizeTaskLabels / parseTaskLabelsStoragePayload', () => {
  it('filters blank labels and normalizes color', () => {
    const labels = sanitizeTaskLabels([
      { id: 'a', text: 'Work', color: '#ff0000' },
      { id: 'b', text: '', color: 'nope' },
      { text: 'Home', color: 'blue' },
    ]);
    expect(labels).toHaveLength(2);
    expect(labels[0].color).toBe('#ff0000');
    expect(labels[1].text).toBe('Home');
    expect(labels[1].color).toBe('#64748b');
  });

  it('returns [] for hostile localStorage payloads', () => {
    expect(parseTaskLabelsStoragePayload('{"hack":true}')).toEqual([]);
    expect(parseTaskLabelsStoragePayload('not-json')).toEqual([]);
  });
});
