import type { TournamentConfig, Team, Player, SoldPlayer, Category } from '@/types';
import type { DraftState } from '@/types/draft';

// ─── Viewer Phase State Machine ─────────────────────────────────────────────

export type ViewerPhase = 'IDLE' | 'BIDDING' | 'SOLD' | 'UNSOLD' | 'SQUAD_VIEW' | 'DRAFT';

// ─── Sub-payloads ───────────────────────────────────────────────────────────

/** A single bid-log entry. `teamId` is the stable identity — names may be blank or duplicated. */
export interface BidLogEntry {
  teamId: number;
  teamName: string;
  teamColor: string;
  bid: number;
}

export interface BiddingPayload {
  player: Player;
  currentBid: number;
  leadingTeamId: number | null;
  log: BidLogEntry[];
}

export interface SoldPayload {
  player: Player;
  teamId: number;
  teamName: string;
  teamColor: string;
  teamLogoBase64: string | null;
  finalPrice: number;
}

// ─── Admin → Viewer Messages ────────────────────────────────────────────────

/** Unsold-overlay details, carried by both UNSOLD and SYNC_STATE (so a viewer
 *  that connects mid-UNSOLD doesn't render a blank stage). */
export interface UnsoldInfo {
  player: Player;
  demoted: boolean;
  newCategory?: Category;
  halvedInPlace?: boolean;
}

export interface SyncStateMessage {
  type: 'SYNC_STATE';
  config: TournamentConfig;
  teams: Team[];
  players: Player[];
  soldPlayers: SoldPlayer[];
  phase: ViewerPhase;
  bidding: BiddingPayload | null;
  lastSold: SoldPayload | null;
  unsoldInfo: UnsoldInfo | null;
  draftState: DraftState | null;
}

/**
 * Push the live draft board to the projector (Event Mode, spec §2.20). Carries a
 * fresh snapshot so the on-the-clock team updates immediately on each pick; the
 * viewer derives the pick context from draftState + soldPlayers.
 */
export interface DraftClockMessage {
  type: 'DRAFT_CLOCK';
  draftState: DraftState;
  teams: Team[];
  players: Player[];
  soldPlayers: SoldPlayer[];
}

export interface BiddingStartMessage {
  type: 'BIDDING_START';
  player: Player;
  currentBid: number;
}

export interface BidUpdateMessage {
  type: 'BID_UPDATE';
  currentBid: number;
  leadingTeamId: number;
  logEntry: BidLogEntry;
}

export interface SoldMessage {
  type: 'SOLD';
  soldPayload: SoldPayload;
  soldPlayers: SoldPlayer[];
  players: Player[];
}

export interface UnsoldMessage {
  type: 'UNSOLD';
  player: Player;
  demoted: boolean;
  newCategory?: Category;
  halvedInPlace?: boolean;
  players: Player[];
}

export interface BiddingCancelMessage { type: 'BIDDING_CANCEL'; }
export interface ShowSquadsMessage    { type: 'SHOW_SQUADS'; }
export interface ShowIdleMessage      { type: 'SHOW_IDLE'; }

export interface UndoSaleMessage {
  type: 'UNDO_SALE';
  soldPlayers: SoldPlayer[];
  players: Player[];
}

/**
 * Replaces the viewer's entire live bidding payload. Used when the admin rolls
 * the bid back to an arbitrary earlier state (Undo Bid) that the incremental
 * BID_UPDATE / BIDDING_START messages cannot express.
 */
export interface BiddingSyncMessage {
  type: 'BIDDING_SYNC';
  bidding: BiddingPayload;
}

export type LiveMessage =
  | SyncStateMessage
  | BiddingStartMessage
  | BidUpdateMessage
  | SoldMessage
  | UnsoldMessage
  | BiddingCancelMessage
  | ShowSquadsMessage
  | ShowIdleMessage
  | UndoSaleMessage
  | BiddingSyncMessage
  | DraftClockMessage;

// ─── Viewer → Admin Request ─────────────────────────────────────────────────

export interface SyncRequestMessage { type: 'SYNC_REQUEST'; }

export type ChannelMessage = LiveMessage | SyncRequestMessage;
