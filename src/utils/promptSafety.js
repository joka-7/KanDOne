import { safeStr } from '../sanitize';

/** Wrap user-controlled text so it is clearly bounded in LLM prompts.
 * Escapes newlines and control characters to prevent prompt injection.
 */
export function delimUserField(value, maxLen = 500) {
  const s = safeStr(value)
    .slice(0, maxLen)
    .replace(/[\n\r\t]/g, ' ') // Strip newlines, carriage returns, tabs
    .replace(/[\<\>]/g, '') // Remove angle brackets
    .trim();
  return `<<<${s}>>>`;
}
