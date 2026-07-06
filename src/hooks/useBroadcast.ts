import { useEffect, useMemo, useRef, useCallback } from 'react';
import type { TournamentConfig, Team, Player, SoldPlayer, Category } from '@/types';
import type { DraftState } from '@/types/draft';
import type {
  LiveMessage, SyncStateMessage, BiddingPayload, BidLogEntry, SoldPayload, ViewerPhase, ChannelMessage,
} from '@/types/live';
import { LIVE_CHANNEL_NAME, MAX_LOG_ENTRIES } from '@/constants/auction';

// ─── Params ─────────────────────────────────────────────────────────────────

interface UseBroadcastParams {
  config: TournamentConfig | null;
  teams: Team[];
  players: Player[];
  soldPlayers: SoldPlayer[];
  draftState: DraftState | null;
}

// ─── Return type ────────────────────────────────────────────────────────────

export interface BroadcastHandle {
  broadcastBiddingStart: (player: Player, baseBid: number) => void;
  broadcastBidUpdate:    (currentBid: number, teamId: number, logEntry: BidLogEntry) => void;
  broadcastSold:         (payload: SoldPayload, allSold: SoldPlayer[], allPlayers: Player[]) => void;
  broadcastUnsold:       (player: Player, demoted: boolean, newCategory: Category | undefined, allPlayers: Player[], halvedInPlace?: boolean) => void;
  broadcastBiddingCancel: () => void;
  broadcastShowSquads:   () => void;
  broadcastShowIdle:     () => void;
  broadcastUndoSale:     (allSold: SoldPlayer[], allPlayers: Player[]) => void;
  broadcastBiddingSync:  (bidding: BiddingPayload) => void;
  broadcastDraftClock:   () => void;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useBroadcast({ config, teams, players, soldPlayers, draftState }: UseBroadcastParams): BroadcastHandle {
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Keep latest values in refs so SYNC_REQUEST handler reads fresh data
  const configRef      = useRef(config);
  const teamsRef       = useRef(teams);
  const playersRef     = useRef(players);
  const soldPlayersRef = useRef(soldPlayers);
  const draftStateRef  = useRef(draftState);
  const phaseRef       = useRef<ViewerPhase>('IDLE');
  const biddingRef     = useRef<BiddingPayload | null>(null);
  const lastSoldRef    = useRef<SoldPayload | null>(null);

  configRef.current      = config;
  teamsRef.current       = teams;
  playersRef.current     = players;
  soldPlayersRef.current = soldPlayers;
  draftStateRef.current  = draftState;

  // Send helper
  const send = useCallback((msg: LiveMessage) => {
    channelRef.current?.postMessage(msg);
  }, []);

  // Open channel + listen for SYNC_REQUEST
  useEffect(() => {
    let ch: BroadcastChannel;
    try {
      ch = new BroadcastChannel(LIVE_CHANNEL_NAME);
    } catch {
      console.warn('BroadcastChannel not available — live viewer will not receive updates.');
      return;
    }
    channelRef.current = ch;

    ch.onmessage = (e: MessageEvent<ChannelMessage>) => {
      const cfg = configRef.current;
      if (e.data?.type === 'SYNC_REQUEST' && cfg) {
        const sync: SyncStateMessage = {
          type: 'SYNC_STATE',
          config:      cfg,
          teams:       teamsRef.current,
          players:     playersRef.current,
          soldPlayers: soldPlayersRef.current,
          phase:       phaseRef.current,
          bidding:     biddingRef.current,
          lastSold:    lastSoldRef.current,
          draftState:  draftStateRef.current,
        };
        ch.postMessage(sync);
      }
    };

    return () => { ch.close(); };
  }, []);

  // ── Broadcast methods ─────────────────────────────────────────────────────

  const broadcastBiddingStart = useCallback((player: Player, baseBid: number) => {
    biddingRef.current = { player, currentBid: baseBid, leadingTeamId: null, log: [] };
    lastSoldRef.current = null;
    phaseRef.current = 'BIDDING';
    send({ type: 'BIDDING_START', player, currentBid: baseBid });
  }, [send]);

  const broadcastBidUpdate = useCallback((currentBid: number, teamId: number, logEntry: BidLogEntry) => {
    if (biddingRef.current) {
      biddingRef.current = {
        ...biddingRef.current,
        currentBid,
        leadingTeamId: teamId,
        log: [logEntry, ...biddingRef.current.log.slice(0, MAX_LOG_ENTRIES - 1)],
      };
    }
    send({ type: 'BID_UPDATE', currentBid, leadingTeamId: teamId, logEntry });
  }, [send]);

  const broadcastSold = useCallback((payload: SoldPayload, allSold: SoldPlayer[], allPlayers: Player[]) => {
    lastSoldRef.current = payload;
    biddingRef.current = null;
    phaseRef.current = 'SOLD';
    send({ type: 'SOLD', soldPayload: payload, soldPlayers: allSold, players: allPlayers });
  }, [send]);

  const broadcastUnsold = useCallback((player: Player, demoted: boolean, newCategory: Category | undefined, allPlayers: Player[], halvedInPlace?: boolean) => {
    biddingRef.current = null;
    phaseRef.current = 'UNSOLD';
    send({ type: 'UNSOLD', player, demoted, newCategory, halvedInPlace, players: allPlayers });
  }, [send]);

  const broadcastBiddingCancel = useCallback(() => {
    biddingRef.current = null;
    phaseRef.current = 'IDLE';
    send({ type: 'BIDDING_CANCEL' });
  }, [send]);

  const broadcastShowSquads = useCallback(() => {
    phaseRef.current = 'SQUAD_VIEW';
    send({ type: 'SHOW_SQUADS' });
  }, [send]);

  const broadcastShowIdle = useCallback(() => {
    phaseRef.current = 'IDLE';
    send({ type: 'SHOW_IDLE' });
  }, [send]);

  const broadcastUndoSale = useCallback((allSold: SoldPlayer[], allPlayers: Player[]) => {
    lastSoldRef.current = null;
    phaseRef.current = 'IDLE';
    send({ type: 'UNDO_SALE', soldPlayers: allSold, players: allPlayers });
  }, [send]);

  const broadcastBiddingSync = useCallback((bidding: BiddingPayload) => {
    biddingRef.current = bidding;
    lastSoldRef.current = null;
    phaseRef.current = 'BIDDING';
    send({ type: 'BIDDING_SYNC', bidding });
  }, [send]);

  // Push the draft board to the projector with a fresh snapshot (Event Mode).
  const broadcastDraftClock = useCallback(() => {
    const ds = draftStateRef.current;
    if (!ds) return;
    phaseRef.current = 'DRAFT';
    send({
      type: 'DRAFT_CLOCK',
      draftState:  ds,
      teams:       teamsRef.current,
      players:     playersRef.current,
      soldPlayers: soldPlayersRef.current,
    });
  }, [send]);

  // Stable handle — every method is a stable useCallback, so consumers (and the
  // memo()'d BidTeamPanel) don't churn when App re-renders for unrelated reasons.
  return useMemo(() => ({
    broadcastBiddingStart, broadcastBidUpdate, broadcastSold, broadcastUnsold,
    broadcastBiddingCancel, broadcastShowSquads, broadcastShowIdle, broadcastUndoSale,
    broadcastBiddingSync, broadcastDraftClock,
  }), [
    broadcastBiddingStart, broadcastBidUpdate, broadcastSold, broadcastUnsold,
    broadcastBiddingCancel, broadcastShowSquads, broadcastShowIdle, broadcastUndoSale,
    broadcastBiddingSync, broadcastDraftClock,
  ]);
}
