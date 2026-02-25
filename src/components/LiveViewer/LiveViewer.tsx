import { useState, useEffect, useRef } from 'react';
import { useLiveViewer } from '@/hooks/useLiveViewer';
import type { ViewerPhase } from '@/types/live';
import { TournamentProvider } from '@/context/TournamentContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LiveIdleScreen } from '@/components/LiveIdleScreen/LiveIdleScreen';
import { LiveBiddingScreen } from '@/components/LiveBiddingScreen/LiveBiddingScreen';
import { LiveSoldOverlay } from '@/components/LiveSoldOverlay/LiveSoldOverlay';
import { LiveUnsoldOverlay } from '@/components/LiveUnsoldOverlay/LiveUnsoldOverlay';
import { LiveSquadView } from '@/components/LiveSquadView/LiveSquadView';
import { LogoTransition } from '@/components/LogoTransition/LogoTransition';
import { Avatar } from '@/components/Avatar/Avatar';
import styles from './LiveViewer.module.css';

// ─── Display phase includes LOGO_TRANSITION on top of data phases ───────────

type DisplayPhase = ViewerPhase | 'LOGO_TRANSITION';

// ─── Timing constants (ms) ──────────────────────────────────────────────────

const LOGO_DURATION  = 1800;
const SOLD_DISPLAY   = 5000;
const UNSOLD_DISPLAY = 2500;

// ─── Waiting Screen ─────────────────────────────────────────────────────────

function WaitingScreen() {
  return (
    <div className={styles.waiting}>
      <div className={styles.waitingIcon} aria-hidden="true">🏏</div>
      <h1 className={styles.waitingTitle}>Waiting for Auction</h1>
      <p className={styles.waitingSubtitle}>
        The admin has not started the auction yet. This screen will update automatically.
      </p>
      <div className={styles.waitingDots}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    </div>
  );
}

// ─── Live Viewer App (entry point for ?mode=live) ───────────────────────────

export function LiveViewerApp() {
  const state = useLiveViewer();
  const [displayPhase, setDisplayPhase] = useState<DisplayPhase>('IDLE');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevDataPhase = useRef<ViewerPhase>('IDLE');

  const clearTimers = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (timer2Ref.current) { clearTimeout(timer2Ref.current); timer2Ref.current = null; }
  };

  // Orchestrate transitions when data phase changes
  useEffect(() => {
    const dataPhase = state.phase;
    const prev = prevDataPhase.current;
    prevDataPhase.current = dataPhase;

    // Same phase — no transition needed (e.g. BID_UPDATE within BIDDING)
    if (dataPhase === prev) return;

    clearTimers();

    // ── BIDDING_START: logo transition → bidding screen
    if (dataPhase === 'BIDDING') {
      setDisplayPhase('LOGO_TRANSITION');
      timerRef.current = setTimeout(() => setDisplayPhase('BIDDING'), LOGO_DURATION);
      return;
    }

    // ── SOLD: sold overlay → logo → squad view (or idle if no squads yet)
    if (dataPhase === 'SOLD') {
      setDisplayPhase('SOLD');
      timerRef.current = setTimeout(() => {
        const afterPhase = state.soldPlayers.length > 0 ? 'SQUAD_VIEW' : 'IDLE';
        setDisplayPhase('LOGO_TRANSITION');
        timer2Ref.current = setTimeout(() => setDisplayPhase(afterPhase), LOGO_DURATION);
      }, SOLD_DISPLAY);
      return;
    }

    // ── UNSOLD: unsold overlay → logo → idle (or squad view if squads exist)
    if (dataPhase === 'UNSOLD') {
      setDisplayPhase('UNSOLD');
      timerRef.current = setTimeout(() => {
        const afterPhase = state.soldPlayers.length > 0 ? 'SQUAD_VIEW' : 'IDLE';
        setDisplayPhase('LOGO_TRANSITION');
        timer2Ref.current = setTimeout(() => setDisplayPhase(afterPhase), LOGO_DURATION);
      }, UNSOLD_DISPLAY);
      return;
    }

    // ── All other phases: show directly
    setDisplayPhase(dataPhase);
  }, [state.phase]);

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), []);

  if (!state.connected || !state.config) {
    return (
      <div className={styles.liveRoot}>
        <WaitingScreen />
      </div>
    );
  }

  return (
    <TournamentProvider config={state.config}>
      <ErrorBoundary fallbackLabel="Live Viewer">
        <div className={styles.liveRoot}>
          {/* Spotlight overlays */}
          <div className={styles.spotlightLeft} aria-hidden="true" />
          <div className={styles.spotlightRight} aria-hidden="true" />
          <div className={styles.lightDots} aria-hidden="true" />

          {/* Header bar */}
          <header className={styles.header}>
            <div className={styles.headerLeft}>
              <Avatar
                src={state.config.logoBase64}
                name={state.config.tournamentName}
                size={40}
                color="var(--accent)"
                square
                className={styles.headerLogo}
              />
              <span className={styles.tournamentName}>{state.config.tournamentName}</span>
            </div>
            <div className={styles.liveBadge}>
              <span className={styles.liveDot} />
              LIVE
            </div>
          </header>

          {/* Phase content */}
          <div className={styles.phaseContainer}>
            {displayPhase === 'LOGO_TRANSITION' && (
              <div className={styles.phaseEnter} key="logo-transition">
                <LogoTransition config={state.config} />
              </div>
            )}

            {displayPhase === 'IDLE' && (
              <div className={styles.phaseEnter} key="idle">
                <LiveIdleScreen
                  config={state.config}
                  soldPlayers={state.soldPlayers}
                  teams={state.teams}
                />
              </div>
            )}

            {displayPhase === 'BIDDING' && state.bidding && (
              <div className={styles.phaseEnter} key="bidding">
                <LiveBiddingScreen
                  bidding={state.bidding}
                  teams={state.teams}
                  soldPlayers={state.soldPlayers}
                  config={state.config}
                />
              </div>
            )}

            {displayPhase === 'SOLD' && state.lastSold && (
              <div className={styles.phaseEnter} key="sold">
                <LiveSoldOverlay lastSold={state.lastSold} />
              </div>
            )}

            {displayPhase === 'UNSOLD' && state.unsoldInfo && (
              <div className={styles.phaseEnter} key="unsold">
                <LiveUnsoldOverlay
                  playerName={state.unsoldInfo.playerName}
                  demoted={state.unsoldInfo.demoted}
                  newCategory={state.unsoldInfo.newCategory}
                />
              </div>
            )}

            {displayPhase === 'SQUAD_VIEW' && (
              <div className={styles.phaseEnter} key="squads">
                <LiveSquadView
                  teams={state.teams}
                  soldPlayers={state.soldPlayers}
                  config={state.config}
                />
              </div>
            )}
          </div>
        </div>
      </ErrorBoundary>
    </TournamentProvider>
  );
}
