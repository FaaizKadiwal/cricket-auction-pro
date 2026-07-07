import type { Team } from '@/types';

/**
 * Format a number as locale-aware integer (e.g. 3000 → "3,000")
 */
export function formatPts(n: number): string {
  return Math.round(n).toLocaleString();
}

/** Display label for a team, falling back to "Team {id}" when unnamed. Single source for the fallback. */
export function teamLabel(team: Pick<Team, 'name' | 'id'>): string {
  return team.name.trim() || `Team ${team.id}`;
}

/** teamLabel by id — same "Team {id}" fallback when the team is missing or unnamed. */
export function teamNameById(teams: Team[], id: number): string {
  const team = teams.find((t) => t.id === id);
  return team ? teamLabel(team) : `Team ${id}`;
}

/**
 * Compute value/total as an integer percentage, clamped to 0–100.
 * Returns a number (e.g. for style widths and aria-valuenow), not a string.
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
