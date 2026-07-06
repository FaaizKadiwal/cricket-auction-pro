import type {
  Category, SoldPlayer, BidCapResult, BidValidationResult, CategoryNeed, ValidationError, TournamentConfig,
} from '@/types';
import { getSquadSize } from '@/constants/auction';

// ─── Squad Queries (pure, no config needed) ───────────────────────────────────

export function getSquad(teamId: number, soldPlayers: SoldPlayer[]): SoldPlayer[] {
  return soldPlayers.filter((s) => s.teamId === teamId);
}

export function getSpent(teamId: number, soldPlayers: SoldPlayer[]): number {
  return getSquad(teamId, soldPlayers).reduce((sum, s) => sum + s.finalPrice, 0);
}

export function getCatCount(teamId: number, category: Category, soldPlayers: SoldPlayer[]): number {
  return getSquad(teamId, soldPlayers).filter((s) => s.category === category).length;
}

/** Total points committed across every team. */
export function getTotalSpent(soldPlayers: SoldPlayer[]): number {
  return soldPlayers.reduce((sum, s) => sum + s.finalPrice, 0);
}

/** Tally items by their category, seeding every configured category to 0. */
export function countByCategory(
  items: { category: Category }[],
  config: TournamentConfig,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of config.categories) counts[c.name] = 0;
  for (const it of items) counts[it.category] = (counts[it.category] ?? 0) + 1;
  return counts;
}

// ─── Bidding Cap ──────────────────────────────────────────────────────────────

/**
 * Maximum a captain can bid on the CURRENT player.
 *
 *   slotsAfterWin = squadSize − currentSquadSize − 1
 *   reserve       = slotsAfterWin × minBidReserve
 *   cap           = remainingBudget − reserve
 *
 * After winning this player, the captain must still be able to fill all
 * remaining slots at the minimum possible price (minBidReserve each).
 */
export function getBidCap(
  teamId: number,
  soldPlayers: SoldPlayer[],
  config: TournamentConfig,
): BidCapResult {
  const squadSize    = getSquadSize(config);
  const squad        = getSquad(teamId, soldPlayers);
  const spent        = getSpent(teamId, soldPlayers);
  const remaining    = config.budget - spent;
  const slotsAfterWin = Math.max(0, squadSize - squad.length - 1);
  const reserve      = slotsAfterWin * config.minBidReserve;
  const cap          = remaining - reserve;
  return { cap, reserve, slotsAfterWin, remaining };
}

export type CapStatus = 'safe' | 'warn' | 'danger';

/**
 * Classify a team's remaining bid headroom for colour coding. Unified so the
 * admin sidebar, the bid panel, and the live projector always agree.
 *   danger — capped out, no slots, or can't even afford the next raise
 *   warn   — can afford the next raise but not two
 *   safe   — comfortable
 */
export function getCapStatus(cap: number, currentBid: number, activeInc: number, slotsLeft: number): CapStatus {
  if (cap <= 0 || slotsLeft <= 0 || cap < currentBid + activeInc) return 'danger';
  if (cap < currentBid + activeInc * 2) return 'warn';
  return 'safe';
}

// ─── Bid Validation ───────────────────────────────────────────────────────────

export function validateBid(
  teamId: number,
  soldPlayers: SoldPlayer[],
  category: Category,
  newBid: number,
  config: TournamentConfig,
): BidValidationResult {
  const squadSize = getSquadSize(config);
  const squad     = getSquad(teamId, soldPlayers);

  if (squad.length >= squadSize) {
    return { valid: false, reason: 'Squad is already full.' };
  }

  const catDef = config.categories.find((c) => c.name === category);
  const catLimit = catDef?.max ?? 0;
  if (catLimit > 0 && getCatCount(teamId, category, soldPlayers) >= catLimit) {
    return { valid: false, reason: `${category} category limit reached (max ${catLimit} per team).` };
  }

  const { cap, slotsAfterWin, reserve } = getBidCap(teamId, soldPlayers, config);
  if (newBid > cap) {
    return {
      valid: false,
      reason:
        `Bid cap exceeded. Must keep ${reserve.toLocaleString()} pts in reserve ` +
        `(${slotsAfterWin} slot${slotsAfterWin !== 1 ? 's' : ''} × ${config.minBidReserve} min). ` +
        `Max allowed: ${cap.toLocaleString()} pts.`,
    };
  }

  return { valid: true };
}

// ─── Category Minimums ────────────────────────────────────────────────────────

/**
 * Per-team categories whose configured minimum is not yet met. Categories with
 * `min === 0` (no minimum) are ignored. Used to warn the operator that a team
 * still owes players in a category.
 */
export function getCategoryNeeds(
  teamId: number,
  soldPlayers: SoldPlayer[],
  config: TournamentConfig,
): CategoryNeed[] {
  const needs: CategoryNeed[] = [];
  for (const c of config.categories) {
    if (c.min <= 0) continue;
    const count = getCatCount(teamId, c.name, soldPlayers);
    if (count < c.min) needs.push({ category: c.name, count, min: c.min, need: c.min - count });
  }
  return needs;
}

// ─── Sale Correction ──────────────────────────────────────────────────────────

/**
 * Validate reassigning an already-sold player to `newTeamId` at `newFinalPrice`
 * (used to correct a mis-clicked sale after the fact). The sale being edited is
 * excluded from the target team's totals so a same-team price tweak, or a move
 * back to a team the player is already on, is measured correctly.
 *
 * The bidding-time reserve cap is intentionally NOT applied here: this is an
 * administrative correction of a historical price, not a live bid. Only the
 * hard invariants that keep the math consistent are enforced — squad size,
 * per-category max, and never spending more than the budget.
 */
export function validateSaleEdit(
  soldPlayers: SoldPlayer[],
  playerId: number,
  category: Category,
  newTeamId: number,
  newFinalPrice: number,
  config: TournamentConfig,
): BidValidationResult {
  const squadSize = getSquadSize(config);

  if (!Number.isFinite(newFinalPrice) || newFinalPrice < 1) {
    return { valid: false, reason: 'Price must be at least 1 pt.' };
  }

  // Everything on the target team except the sale we are editing.
  const others = soldPlayers.filter((s) => s.teamId === newTeamId && s.id !== playerId);

  if (others.length + 1 > squadSize) {
    return { valid: false, reason: `Squad is already full (${squadSize} players).` };
  }

  const catDef = config.categories.find((c) => c.name === category);
  const catLimit = catDef?.max ?? 0;
  if (catLimit > 0 && others.filter((s) => s.category === category).length + 1 > catLimit) {
    return { valid: false, reason: `${category} limit reached (max ${catLimit} per team).` };
  }

  const otherSpend = others.reduce((sum, s) => sum + s.finalPrice, 0);
  const remaining = config.budget - otherSpend;
  if (newFinalPrice > remaining) {
    return { valid: false, reason: `Exceeds budget — only ${remaining.toLocaleString()} pts available on this team.` };
  }

  return { valid: true };
}

// ─── Form Validation ──────────────────────────────────────────────────────────

export function validatePlayerForm(name: string, basePrice: number): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!name.trim()) {
    errors.push({ field: 'name', message: 'Player name is required.' });
  } else if (name.trim().length > 60) {
    errors.push({ field: 'name', message: 'Name must be 60 characters or fewer.' });
  }
  if (isNaN(basePrice) || basePrice < 1) {
    errors.push({ field: 'basePrice', message: 'Base price must be a positive number.' });
  }
  return errors;
}

export function validateConfig(
  totalTeams: number,
  playersPerTeam: number,
  budget: number,
  minBidReserve: number,
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!Number.isInteger(totalTeams) || totalTeams < 2 || totalTeams > 20)
    errors.push({ field: 'totalTeams', message: 'Teams must be between 2 and 20.' });
  if (!Number.isInteger(playersPerTeam) || playersPerTeam < 3 || playersPerTeam > 15)
    errors.push({ field: 'playersPerTeam', message: 'Players per team must be between 3 and 15.' });
  if (isNaN(budget) || budget < 100)
    errors.push({ field: 'budget', message: 'Budget must be at least 100 pts.' });
  if (isNaN(minBidReserve) || minBidReserve < 0)
    errors.push({ field: 'minBidReserve', message: 'Min bid reserve must be 0 or more.' });
  if (errors.length === 0 && minBidReserve * (playersPerTeam - 1) > budget)
    errors.push({ field: 'minBidReserve', message: 'Total reserve exceeds budget — lower the reserve or raise the budget.' });
  return errors;
}
