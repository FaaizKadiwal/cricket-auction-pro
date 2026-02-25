import { useEffect, useReducer, useRef } from 'react';
import type { TournamentConfig, Team, Player, SoldPlayer } from '@/types';
import type { ViewerPhase, BiddingPayload, SoldPayload, LiveMessage } from '@/types/live';
import { LIVE_CHANNEL_NAME } from '@/constants/auction';

// ─── Viewer State ───────────────────────────────────────────────────────────

export interface ViewerState {
  phase: ViewerPhase;
  config: TournamentConfig | null;
  teams: Team[];
  players: Player[];
  soldPlayers: SoldPlayer[];
  bidding: BiddingPayload | null;
  lastSold: SoldPayload | null;
  unsoldInfo: { playerName: string; demoted: boolean; newCategory?: string } | null;
  connected: boolean;
}

const initialState: ViewerState = {
  phase: 'IDLE',
  config: null,
  teams: [],
  players: [],
  soldPlayers: [],
  bidding: null,
  lastSold: null,
  unsoldInfo: null,
  connected: false,
};

// ─── Reducer ────────────────────────────────────────────────────────────────

type ViewerAction = LiveMessage | { type: 'AUTO_IDLE' };

function viewerReducer(state: ViewerState, action: ViewerAction): ViewerState {
  switch (action.type) {
    case 'SYNC_STATE':
      return {
        ...state,
        connected: true,
        phase: action.phase,
        config: action.config,
        teams: action.teams,
        players: action.players,
        soldPlayers: action.soldPlayers,
        bidding: action.bidding,
        lastSold: action.lastSold,
        unsoldInfo: null,
      };

    case 'BIDDING_START':
      return {
        ...state,
        phase: 'BIDDING',
        bidding: {
          player: action.player,
          currentBid: action.currentBid,
          leadingTeamId: null,
          log: [],
        },
        lastSold: null,
        unsoldInfo: null,
      };

    case 'BID_UPDATE':
      if (!state.bidding) return state;
      return {
        ...state,
        bidding: {
          ...state.bidding,
          currentBid: action.currentBid,
          leadingTeamId: action.leadingTeamId,
          log: [action.logEntry, ...state.bidding.log.slice(0, 59)],
        },
      };

    case 'SOLD':
      return {
        ...state,
        phase: 'SOLD',
        lastSold: action.soldPayload,
        bidding: null,
        soldPlayers: action.soldPlayers,
        players: action.players,
      };

    case 'UNSOLD':
      return {
        ...state,
        phase: 'UNSOLD',
        bidding: null,
        unsoldInfo: { playerName: action.playerName, demoted: action.demoted, newCategory: action.newCategory },
        players: action.players,
      };

    case 'BIDDING_CANCEL':
      return { ...state, phase: 'IDLE', bidding: null };

    case 'SHOW_SQUADS':
      return { ...state, phase: 'SQUAD_VIEW' };

    case 'SHOW_IDLE':
      return { ...state, phase: 'IDLE' };

    case 'UNDO_SALE':
      return {
        ...state,
        phase: 'IDLE',
        lastSold: null,
        soldPlayers: action.soldPlayers,
        players: action.players,
      };

    case 'AUTO_IDLE':
      return state.phase === 'SOLD' || state.phase === 'UNSOLD'
        ? { ...state, phase: 'IDLE' }
        : state;

    default:
      return state;
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useLiveViewer(): ViewerState {
  const [state, dispatch] = useReducer(viewerReducer, initialState);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Open channel and listen for messages
  useEffect(() => {
    const ch = new BroadcastChannel(LIVE_CHANNEL_NAME);
    channelRef.current = ch;

    ch.onmessage = (e: MessageEvent<LiveMessage>) => {
      dispatch(e.data);
    };

    // Request sync on connect
    ch.postMessage({ type: 'SYNC_REQUEST' });

    // Retry sync every 3s until connected
    const interval = setInterval(() => {
      ch.postMessage({ type: 'SYNC_REQUEST' });
    }, 3000);

    return () => {
      clearInterval(interval);
      ch.close();
    };
  }, []);

  // Note: Auto-transition timers are managed by LiveViewer component
  // which orchestrates logo transitions between phases.

  return state;
}
