/**
 * Switching back to the tab pulls from Drive, and a pull downloads every
 * device's file. People flip between tabs constantly, so without a floor on the
 * gap, ordinary use turns into a steady stream of full reads — and a burst of
 * them is exactly what makes Drive start answering "too many requests".
 */
export const FOCUS_PULL_MIN_INTERVAL_MS = 30_000;

/**
 * @param {number | null} lastPullAt when the last pull finished, or null if none has
 * @param {number} now the current time
 */
export function isFocusPullDue(lastPullAt, now) {
  if (lastPullAt === null) return true;
  // A clock that moved backwards must not block pulling until it catches up.
  if (lastPullAt > now) return true;
  return now - lastPullAt >= FOCUS_PULL_MIN_INTERVAL_MS;
}
