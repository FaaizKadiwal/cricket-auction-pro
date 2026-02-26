import type {
  Category, SoldPlayer, BidCapResult, BidValidationResult, ValidationError, TournamentConfig,
} from '@/types';

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

export function getRemainingBudget(teamId: number, soldPlayers: SoldPlayer[], budget: number): number {
  return budget - getSpent(teamId, soldPlayers);
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
  const squadSize    = config.playersPerTeam - 1;
  const squad        = getSquad(teamId, soldPlayers);
  const spent        = getSpent(teamId, soldPlayers);
  const remaining    = config.budget - spent;
  const slotsAfterWin = Math.max(0, squadSize - squad.length - 1);
  const reserve      = slotsAfterWin * config.minBidReserve;
  const cap          = remaining - reserve;
  return { cap, reserve, slotsAfterWin, remaining };
}

// ─── Bid Validation ───────────────────────────────────────────────────────────

export function validateBid(
  teamId: number,
  soldPlayers: SoldPlayer[],
  category: Category,
  newBid: number,
  config: TournamentConfig,
): BidValidationResult {
  const squadSize = config.playersPerTeam - 1;
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

export function validateTeamForm(name: string, captain: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!name.trim())    errors.push({ field: 'name',    message: 'Team name is required.'    });
  if (!captain.trim()) errors.push({ field: 'captain', message: 'Captain name is required.' });
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
  return errors;
}
