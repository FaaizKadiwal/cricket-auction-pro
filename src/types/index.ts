// ─── Primitive Domain Types ───────────────────────────────────────────────────

export type Category = string;
export type PlayerStatus = 'pending' | 'sold' | 'unsold';
export type ToastType = 'ok' | 'warn';
export type TabId = 'setup' | 'auction' | 'draft' | 'squads' | 'rules';

/** How players are acquired: bidding (auction) or turn-based picking (draft). */
export type TournamentMode = 'auction' | 'draft';

// ─── Tournament Configuration ─────────────────────────────────────────────────

export interface CategoryDefinition {
  name: string;    // display name, e.g. "Gold", "Platinum"
  color: string;   // hex color, e.g. "#FFD700"
  bgColor: string; // dark background for badges, e.g. "#2a1f00"
  min: number;     // minimum picks per team (0 = no minimum) — auction mode
  max: number;     // maximum picks per team (0 = unlimited) — auction mode
  draftCount: number; // exact picks per team of this category in DRAFT mode (rounds); Σ must equal squadSize
}

export interface TournamentConfig {
  tournamentName: string;
  mode: TournamentMode;      // 'auction' (bidding) or 'draft' (turn-based picking)
  totalTeams: number;        // e.g. 6
  playersPerTeam: number;    // including captain, e.g. 8 → squadSize = 7
  budget: number;            // per team, e.g. 3000 — auction mode only
  minBidReserve: number;     // held per remaining slot, e.g. 100 — auction mode only
  categories: CategoryDefinition[]; // ordered highest → lowest tier
  logoBase64: string | null; // tournament logo image
}

// ─── Entity Interfaces ────────────────────────────────────────────────────────

export interface Team {
  id: number;
  name: string;
  captain: string;
  color: string;
  logoBase64: string | null;    // resized team logo
  captainBase64: string | null; // captain portrait
}

export interface Player {
  id: number;
  name: string;
  description: string;        // short bio shown on auction stage
  category: Category;
  basePrice: number;
  status: PlayerStatus;
  photoBase64: string | null; // player portrait
}

/** Player acquired via auction or draft — extends Player with acquisition data */
export interface SoldPlayer extends Player {
  teamId: number;
  teamName: string;
  teamColor: string;
  finalPrice: number;    // 0 for draft picks (no bidding)
  soldAt?: string;       // ISO timestamp of the sale/pick (spec §7.6)
}

// ─── Auction Result Types ─────────────────────────────────────────────────────

export interface DemotionResult {
  demoted: boolean;
  newCategory?: Category;
  newBasePrice?: number;
  halvedInPlace?: boolean;
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export interface ToastMessage {
  id: number;
  msg: string;
  type: ToastType;
}

export interface ValidationError {
  field: string;
  message: string;
}

// ─── Auction Computation ──────────────────────────────────────────────────────

export interface BidCapResult {
  cap: number;
  reserve: number;
  slotsAfterWin: number;
  remaining: number;
}

export interface BidValidationResult {
  valid: boolean;
  reason?: string;
}

/** An unmet per-team category minimum (only produced when count < min). */
export interface CategoryNeed {
  category: Category;
  count: number;
  min: number;
  need: number; // min − count, always > 0
}
