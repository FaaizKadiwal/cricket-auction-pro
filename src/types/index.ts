// ─── Primitive Domain Types ───────────────────────────────────────────────────

export type Category = string;
export type PlayerStatus = 'pending' | 'sold' | 'unsold';
export type ToastType = 'ok' | 'warn';
export type TabId = 'setup' | 'auction' | 'squads' | 'rules';

// ─── Tournament Configuration ─────────────────────────────────────────────────

export interface CategoryDefinition {
  name: string;    // display name, e.g. "Gold", "Platinum"
  color: string;   // hex color, e.g. "#FFD700"
  bgColor: string; // dark background for badges, e.g. "#2a1f00"
  min: number;     // minimum picks per team (0 = no minimum)
  max: number;     // maximum picks per team (0 = unlimited)
}

export interface TournamentConfig {
  tournamentName: string;
  totalTeams: number;        // e.g. 6
  playersPerTeam: number;    // including captain, e.g. 8 → squadSize = 7
  budget: number;            // per team, e.g. 3000
  minBidReserve: number;     // held per remaining slot, e.g. 100
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
