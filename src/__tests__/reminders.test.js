import { describe, it, expect, vi, afterEach } from 'vitest';
import { showReminderNotification } from '../utils/reminders';

describe('showReminderNotification', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it.each([
    ['a service worker is active', true],
    ['no service worker is registered', false],
  ])('when %s, routes through the right API', async (_scenario, hasWorker) => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const NotificationCtor = vi.fn();
    vi.stubGlobal('Notification', NotificationCtor);
    const nav = {
      serviceWorker: {
        getRegistration: async () => (hasWorker ? { showNotification } : undefined),
      },
    };

    await showReminderNotification('Pay rent', { body: 'today' }, nav);

    expect(showNotification).toHaveBeenCalledTimes(hasWorker ? 1 : 0);
    expect(NotificationCtor).toHaveBeenCalledTimes(hasWorker ? 0 : 1);
  });
});
