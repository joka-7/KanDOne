import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

afterEach(() => vi.restoreAllMocks());

describe('useOnlineStatus', () => {
  it('follows the browser going offline and coming back', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const { result } = renderHook(() => useOnlineStatus());
    const seen = [result.current];

    onLine.mockReturnValue(false);
    act(() => { window.dispatchEvent(new Event('offline')); });
    seen.push(result.current);
    onLine.mockReturnValue(true);
    act(() => { window.dispatchEvent(new Event('online')); });
    seen.push(result.current);

    expect(seen).toEqual([true, false, true]);
  });
});
