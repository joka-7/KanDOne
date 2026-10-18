/**
 * What the header's Drive control should say. One pure function so the rules
 * (above all: no network is "offline", never "Reconnecting…" or "Connect
 * Drive") are testable without rendering the app.
 *
 * `offline` is true when the browser reports no network or the last Drive
 * request could not reach Google at all.
 *
 * @returns {'unconfigured'|'checking'|'offline'|'syncing'|'error'|'connected'|'reconnecting'|'signed-out'}
 */
export function deriveSyncStatus({
  configured, authResolved, user, sessionRestorable, syncing, syncError, offline,
}) {
  if (!configured) return 'unconfigured';
  if (!authResolved) return 'checking';
  // Before the sign-in check: a browser whose token lapsed overnight reports
  // no user, and "Connect Drive" cannot work without a network.
  if (offline) return 'offline';
  if (!user && !sessionRestorable) return 'signed-out';
  if (!user) return 'reconnecting';
  if (syncing) return 'syncing';
  return syncError ? 'error' : 'connected';
}
