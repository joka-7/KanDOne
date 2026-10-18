import { describe, it, expect } from 'vitest';
import { deriveSyncStatus } from '../utils/syncStatus';

const base = {
  configured: true, authResolved: true, user: { uid: 'u' }, sessionRestorable: true,
  syncing: false, syncError: false, offline: false,
};

describe('deriveSyncStatus', () => {
  it.each([
    ['no Google client configured', { configured: false }, 'unconfigured'],
    ['the session is still being checked', { authResolved: false, user: null }, 'checking'],
    ['signed in and idle', {}, 'connected'],
    ['signed in and syncing', { syncing: true }, 'syncing'],
    ['signed in after a failed sync', { syncError: true }, 'error'],
    ['a stored session not yet confirmed', { user: null }, 'reconnecting'],
    ['never connected', { user: null, sessionRestorable: false }, 'signed-out'],
    ['signed in with no network', { offline: true }, 'offline'],
    ['a failed sync that was really a lost network', { offline: true, syncError: true }, 'offline'],
    ['a stored session and no network, which cannot reconnect', { user: null, offline: true }, 'offline'],
    ['never connected or lapsed overnight, and no network', { user: null, sessionRestorable: false, offline: true }, 'offline'],
    ['no network during the first check', { authResolved: false, user: null, offline: true }, 'checking'],
  ])('is %s -> %s', (_scenario, overrides, expected) => {
    expect(deriveSyncStatus({ ...base, ...overrides })).toBe(expected);
  });
});
