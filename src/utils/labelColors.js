export const LABEL_COLOR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
];

/**
 * Background tints for board/list cards. The empty string means "none"
 * (the default white card). Colors are saturated enough to be clearly
 * visible on a white/slate background while keeping dark text readable.
 */
export const CARD_COLOR_PALETTE = [
  '',
  '#fca5a5', '#fdba74', '#fcd34d', '#fde047', '#bef264', '#86efac',
  '#6ee7b7', '#5eead4', '#67e8f9', '#7dd3fc', '#93c5fd', '#a5b4fc',
  '#c4b5fd', '#d8b4fe', '#f0abfc', '#f9a8d4', '#fda4af', '#cbd5e1',
];

export function readableTextColor(hex) {
  const c = String(hex || '').replace('#', '');
  if (c.length !== 6) return '#1f2937';
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1f2937' : '#ffffff';
}
