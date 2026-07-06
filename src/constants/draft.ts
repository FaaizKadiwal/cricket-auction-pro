/**
 * The Balanced Custom Grid — a fixed, mathematically-proven fair pick-order table
 * for a **6-team, 7-round draft grouped 2-3-2** (two 2-round "even" categories
 * flanking one 3-round "odd" category).
 *
 * This is an algorithmic constant (like the bid-increment tiers), NOT tournament
 * data. It is applied ONLY when a draft's shape exactly matches — every other
 * configuration falls back to a generalized snake draft (see `canUseBalancedGrid`
 * in `utils/draft.ts`). No team/player/captain data is ever hardcoded.
 *
 * `BALANCED_GRID[slotIndex][roundIndex]` = the pick position (1 = first, 6 = last)
 * of the team occupying that base-order slot, in that round.
 *
 * Proven properties (verifiable by inspection): every column is a permutation of
 * 1..6; every position is used exactly 7 times; each team's Gold and Bronze
 * totals are 7 (spread 0), Silver is 10 or 11 (spread 1), overall is 24 or 25.
 */
export const BALANCED_GRID: readonly (readonly number[])[] = [
  [1, 6, 2, 3, 5, 3, 4], // S1
  [2, 5, 4, 6, 1, 4, 3], // S2
  [3, 4, 5, 4, 2, 1, 6], // S3
  [4, 3, 3, 1, 6, 2, 5], // S4
  [5, 2, 1, 5, 4, 6, 1], // S5
  [6, 1, 6, 2, 3, 5, 2], // S6
] as const;

/** The round grouping the grid is proven for: 2 + 3 + 2 = 7 rounds across 6 teams. */
export const BALANCED_GRID_TEAMS = 6;
export const BALANCED_GRID_GROUPS = [2, 3, 2] as const;
