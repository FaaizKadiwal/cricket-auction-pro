// ─── Primitive Domain Types ───────────────────────────────────────────────────

export type Category = 'Gold' | 'Silver' | 'Bronze';
export type PlayerStatus = 'pending' | 'sold' | 'unsold';
export type ToastType = 'ok' | 'warn';
export type TabId = 'setup' | 'auction' | 'squads' | 'rules';

// ─── Tournament Configuration ─────────────────────────────────────────────────

export interface CategoryLimit {
  max: number; // max picks per team; 0 = unlimited (capped by squadSize)
}

export interface TournamentConfig {
  tournamentName: string;
  totalTeams: number;        // e.g. 6
  playersPerTeam: number;    // including captain, e.g. 8 → squadSize = 7
  budget: number;            // per team, e.g. 3000
  minBidReserve: number;     // held per remaining slot, e.g. 100
  categoryLimits: Record<Category, CategoryLimit>;
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
  category: Category;
  basePrice: number;
  status: PlayerStatus;
  photoBase64: string | null; // player portrait
}

/** Player that has been won at auction — extends Player with sale data */
export interface SoldPlayer extends Player {
  teamId: number;
  teamName: string;
  teamColor: string;
  finalPrice: number;
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
