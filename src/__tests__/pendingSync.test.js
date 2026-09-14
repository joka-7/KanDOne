import { describe, it, expect } from 'vitest';
import {
  fingerprintItems, diffFingerprints, readPending, recordLocalChanges,
  clearPendingIds, pendingStorageKey,
} from '../utils/pendingSync';

/** In-memory stand-in for localStorage — keeps these tests off real storage. */
function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    has: (k) => map.has(k),
  };
}

/** Storage that rejects every write, as a full or blocked quota does. */
const blockedStorage = {
  getItem: () => null,
  setItem: () => { throw new Error('QuotaExceededError'); },
  removeItem: () => { throw new Error('QuotaExceededError'); },
};

const MODE = 'tasks';
const sorted = (set) => [...set].sort();

describe('fingerprintItems', () => {
  it('keys records by id and detects content, not just membership', () => {
    const before = fingerprintItems([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
    expect(sorted(before.keys())).toEqual(['1', '2']);
    expect(before.get('1')).not.toBe(before.get('2'));
    expect(fingerprintItems(null).size).toBe(0);
  });
});

describe('diffFingerprints', () => {
  it('reports added, changed and removed ids', () => {
    const before = fingerprintItems([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
    const after = fingerprintItems([{ id: 1, name: 'A edited' }, { id: 3, name: 'C' }]);
    const { edited, deleted } = diffFingerprints(before, after);
    expect(edited.sort()).toEqual(['1', '3']);
    expect(deleted).toEqual(['2']);
  });

  it('reports nothing when the collection is untouched', () => {
    const items = [{ id: 1, name: 'A' }];
    const { edited, deleted } = diffFingerprints(fingerprintItems(items), fingerprintItems(items));
    expect(edited).toEqual([]);
    expect(deleted).toEqual([]);
  });
});

describe('pending record bookkeeping', () => {
  it('accumulates local changes and clears them only once the cloud write lands', () => {
    const storage = fakeStorage();
    recordLocalChanges(MODE, { edited: ['1', '2'] }, storage);
    expect(sorted(readPending(MODE, storage).edited)).toEqual(['1', '2']);

    clearPendingIds(MODE, ['1'], storage);
    expect(sorted(readPending(MODE, storage).edited)).toEqual(['2']);
  });

  it('holds an id in exactly one of edited/deleted as it changes state', () => {
    const storage = fakeStorage();
    recordLocalChanges(MODE, { edited: ['1'] }, storage);
    recordLocalChanges(MODE, { deleted: ['1'] }, storage);
    expect(sorted(readPending(MODE, storage).edited)).toEqual([]);
    expect(sorted(readPending(MODE, storage).deleted)).toEqual(['1']);

    recordLocalChanges(MODE, { edited: ['1'] }, storage);
    expect(sorted(readPending(MODE, storage).edited)).toEqual(['1']);
    expect(sorted(readPending(MODE, storage).deleted)).toEqual([]);
  });

  it('removes the storage entry once nothing is pending', () => {
    const storage = fakeStorage();
    recordLocalChanges(MODE, { edited: ['1'] }, storage);
    clearPendingIds(MODE, ['1'], storage);
    expect(storage.has(pendingStorageKey(MODE))).toBe(false);
  });

  it('keeps collections separate so one cannot pin another', () => {
    const storage = fakeStorage();
    recordLocalChanges('tasks', { edited: ['1'] }, storage);
    recordLocalChanges('other', { edited: ['2'] }, storage);
    expect(sorted(readPending('tasks', storage).edited)).toEqual(['1']);
    expect(sorted(readPending('other', storage).edited)).toEqual(['2']);
  });

  it('reads empty rather than throwing on malformed, missing or blocked storage', () => {
    expect(sorted(readPending(MODE, fakeStorage({ [pendingStorageKey(MODE)]: '{oops' })).edited)).toEqual([]);
    expect(sorted(readPending(MODE, fakeStorage()).edited)).toEqual([]);
    expect(sorted(readPending(MODE, null).edited)).toEqual([]);
    expect(() => recordLocalChanges(MODE, { edited: ['1'] }, blockedStorage)).not.toThrow();
  });
});
