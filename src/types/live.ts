import type { TournamentConfig, Team, Player, SoldPlayer, Category } from '@/types';

// ─── Viewer Phase State Machine ─────────────────────────────────────────────

export type ViewerPhase = 'IDLE' | 'BIDDING' | 'SOLD' | 'UNSOLD' | 'SQUAD_VIEW';

// ─── Sub-payloads ───────────────────────────────────────────────────────────

export interface BiddingPayload {
  player: Player;
  currentBid: number;
  leadingTeamId: number | null;
  log: Array<{ teamName: string; teamColor: string; bid: number }>;
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

export interface SyncStateMessage {
  type: 'SYNC_STATE';
  config: TournamentConfig;
  teams: Team[];
  players: Player[];
  soldPlayers: SoldPlayer[];
  phase: ViewerPhase;
  bidding: BiddingPayload | null;
  lastSold: SoldPayload | null;
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
  logEntry: { teamName: string; teamColor: string; bid: number };
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

export type LiveMessage =
  | SyncStateMessage
  | BiddingStartMessage
  | BidUpdateMessage
  | SoldMessage
  | UnsoldMessage
  | BiddingCancelMessage
  | ShowSquadsMessage
  | ShowIdleMessage
  | UndoSaleMessage;

// ─── Viewer → Admin Request ─────────────────────────────────────────────────

export interface SyncRequestMessage { type: 'SYNC_REQUEST'; }

export type ChannelMessage = LiveMessage | SyncRequestMessage;
