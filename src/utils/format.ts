/**
 * Format a number as locale-aware integer (e.g. 3000 → "3,000")
 */
export function formatPts(n: number): string {
  return Math.round(n).toLocaleString();
}

/**
 * Format a percentage to integer string
 */
export function formatPct(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

/**
 * Determine progress bar color class based on usage percentage
 */
export function getBarColorToken(usedPct: number): string {
  if (usedPct > 85) return 'var(--danger)';
  if (usedPct > 60) return 'var(--warning)';
  return 'var(--success)';
}
