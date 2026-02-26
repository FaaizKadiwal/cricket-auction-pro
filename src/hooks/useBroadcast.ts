import { useEffect, useRef, useCallback } from 'react';
import type { TournamentConfig, Team, Player, SoldPlayer, Category } from '@/types';
import type {
  LiveMessage, SyncStateMessage, BiddingPayload, SoldPayload, ViewerPhase, ChannelMessage,
} from '@/types/live';
import { LIVE_CHANNEL_NAME } from '@/constants/auction';

// ─── Params ─────────────────────────────────────────────────────────────────

interface UseBroadcastParams {
  config: TournamentConfig;
  teams: Team[];
  players: Player[];
  soldPlayers: SoldPlayer[];
}

// ─── Return type ────────────────────────────────────────────────────────────

export interface BroadcastHandle {
  broadcastBiddingStart: (player: Player, baseBid: number) => void;
  broadcastBidUpdate:    (currentBid: number, teamId: number, logEntry: { teamName: string; teamColor: string; bid: number }) => void;
  broadcastSold:         (payload: SoldPayload, allSold: SoldPlayer[], allPlayers: Player[]) => void;
  broadcastUnsold:       (playerName: string, demoted: boolean, newCategory: Category | undefined, allPlayers: Player[], halvedInPlace?: boolean) => void;
  broadcastBiddingCancel: () => void;
  broadcastShowSquads:   () => void;
  broadcastShowIdle:     () => void;
  broadcastUndoSale:     (allSold: SoldPlayer[], allPlayers: Player[]) => void;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useBroadcast({ config, teams, players, soldPlayers }: UseBroadcastParams): BroadcastHandle {
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Keep latest values in refs so SYNC_REQUEST handler reads fresh data
  const configRef      = useRef(config);
  const teamsRef       = useRef(teams);
  const playersRef     = useRef(players);
  const soldPlayersRef = useRef(soldPlayers);
  const phaseRef       = useRef<ViewerPhase>('IDLE');
  const biddingRef     = useRef<BiddingPayload | null>(null);
  const lastSoldRef    = useRef<SoldPayload | null>(null);

  configRef.current      = config;
  teamsRef.current       = teams;
  playersRef.current     = players;
  soldPlayersRef.current = soldPlayers;

  // Send helper
  const send = useCallback((msg: LiveMessage) => {
    channelRef.current?.postMessage(msg);
  }, []);

  // Open channel + listen for SYNC_REQUEST
  useEffect(() => {
    const ch = new BroadcastChannel(LIVE_CHANNEL_NAME);
    channelRef.current = ch;

    ch.onmessage = (e: MessageEvent<ChannelMessage>) => {
      if (e.data?.type === 'SYNC_REQUEST') {
        const sync: SyncStateMessage = {
          type: 'SYNC_STATE',
          config:      configRef.current,
          teams:       teamsRef.current,
          players:     playersRef.current,
          soldPlayers: soldPlayersRef.current,
          phase:       phaseRef.current,
          bidding:     biddingRef.current,
          lastSold:    lastSoldRef.current,
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

  const broadcastBidUpdate = useCallback((currentBid: number, teamId: number, logEntry: { teamName: string; teamColor: string; bid: number }) => {
    if (biddingRef.current) {
      biddingRef.current = {
        ...biddingRef.current,
        currentBid,
        leadingTeamId: teamId,
        log: [logEntry, ...biddingRef.current.log.slice(0, 59)],
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

  const broadcastUnsold = useCallback((playerName: string, demoted: boolean, newCategory: Category | undefined, allPlayers: Player[], halvedInPlace?: boolean) => {
    biddingRef.current = null;
    phaseRef.current = 'UNSOLD';
    send({ type: 'UNSOLD', playerName, demoted, newCategory, halvedInPlace, players: allPlayers });
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

  return {
    broadcastBiddingStart, broadcastBidUpdate, broadcastSold, broadcastUnsold,
    broadcastBiddingCancel, broadcastShowSquads, broadcastShowIdle, broadcastUndoSale,
  };
}
