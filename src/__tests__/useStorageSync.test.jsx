import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStorageSync } from '../hooks/useStorageSync';

const KEY = 'tasks-key';

function fireStorage(overrides) {
  window.dispatchEvent(new StorageEvent('storage', {
    key: KEY, newValue: '[]', storageArea: window.localStorage, ...overrides,
  }));
}

describe('useStorageSync', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it.each([
    ['another tab writes the watched key', { newValue: '["a"]' }, { changed: [['a']], removed: 0 }],
    ['another tab writes a different key', { key: 'other' }, { changed: [], removed: 0 }],
    ['another tab removes the watched key', { newValue: null }, { changed: [], removed: 1 }],
    ['sessionStorage changes under the same key', { storageArea: window.sessionStorage }, { changed: [], removed: 0 }],
  ])('when %s, reports %j', (_scenario, eventOverrides, expected) => {
    const onChange = vi.fn();
    const onRemoved = vi.fn();
    renderHook(() => useStorageSync(KEY, JSON.parse, onChange, onRemoved));

    fireStorage(eventOverrides);

    expect(onChange.mock.calls.map(([value]) => value)).toEqual(expected.changed);
    expect(onRemoved).toHaveBeenCalledTimes(expected.removed);
  });

  it('stops listening once unmounted', () => {
    const onChange = vi.fn();
    const { unmount } = renderHook(() => useStorageSync(KEY, JSON.parse, onChange, vi.fn()));

    unmount();
    fireStorage({ newValue: '["a"]' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses the latest callbacks without re-subscribing', () => {
    const first = vi.fn();
    const second = vi.fn();
    const add = vi.spyOn(window, 'addEventListener');
    const { rerender } = renderHook(({ cb }) => useStorageSync(KEY, JSON.parse, cb, vi.fn()), {
      initialProps: { cb: first },
    });

    rerender({ cb: second });
    fireStorage({ newValue: '["a"]' });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(['a']);
    expect(add.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(1);
  });
});
