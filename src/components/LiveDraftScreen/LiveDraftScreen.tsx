import { useMemo } from 'react';
import type { TournamentConfig, Team, Player, SoldPlayer } from '@/types';
import type { DraftState } from '@/types/draft';
import { getCategoryStyle } from '@/constants/auction';
import { getPickContext, generatePickOrder, getRoundSchedule } from '@/utils/draft';
import { teamLabel } from '@/utils/format';
import { Avatar } from '@/components/Avatar/Avatar';
import styles from './LiveDraftScreen.module.css';

interface LiveDraftScreenProps {
  draftState: DraftState;
  teams: Team[];
  players: Player[];
  soldPlayers: SoldPlayer[];
  config: TournamentConfig;
}

/** Full-screen "on the clock" draft board for the projector (Event Mode, spec §2.20). */
export function LiveDraftScreen({ draftState, teams, players, soldPlayers, config }: LiveDraftScreenProps) {
  const T = config.totalTeams;
  const schedule = useMemo(() => getRoundSchedule(config), [config]);
  const pickOrder = useMemo(() => generatePickOrder(config, draftState.baseOrder), [config, draftState.baseOrder]);
  const pickCtx = getPickContext(config, draftState.baseOrder, soldPlayers.length);
  const onClock = teams.find((t) => t.id === pickCtx.onClockTeamId) ?? null;

  if (pickCtx.complete) {
    return (
      <div className={styles.complete}>
        <div className={styles.completeIcon} aria-hidden="true">🏆</div>
        <h1 className={styles.completeTitle}>DRAFT COMPLETE</h1>
        <p className={styles.completeSub}>{config.tournamentName}</p>
      </div>
    );
  }

  const catStyle = getCategoryStyle(config, pickCtx.category);
  const counters = config.categories
    .filter((c) => c.draftCount > 0)
    .map((c) => ({ cat: c.name, remaining: players.filter((p) => p.status === 'pending' && p.category === c.name).length }));

  const upcoming: Team[] = [];
  for (let i = soldPlayers.length + 1; i < soldPlayers.length + 4 && i < pickCtx.totalPicks; i++) {
    const tm = teams.find((t) => t.id === pickOrder[Math.floor(i / T)]?.[i % T]);
    if (tm) upcoming.push(tm);
  }
  const lastPicks: { player: Player; team: Team | undefined; round: number }[] = [];
  for (let i = soldPlayers.length - 1; i >= 0 && lastPicks.length < 5; i--) {
    lastPicks.push({ player: soldPlayers[i], team: teams.find((t) => t.id === soldPlayers[i].teamId), round: Math.floor(i / T) + 1 });
  }

  return (
    <div className={styles.screen}>
      <div className={styles.metaRow}>
        <span className={styles.round}>ROUND {pickCtx.round}<span className={styles.of}>/{schedule.length}</span></span>
        <span className={styles.catBadge} style={{ color: catStyle.color, background: catStyle.bg, borderColor: `${catStyle.color}55` }}>{pickCtx.category}</span>
        <span className={styles.pickNum}>PICK {pickCtx.pickNumber}<span className={styles.of}>/{pickCtx.totalPicks}</span></span>
      </div>

      <div className={styles.clock} key={pickCtx.pickNumber}>
        <span className={styles.onClockLabel}>ON THE CLOCK</span>
        {onClock && (
          <>
            <Avatar src={onClock.logoBase64} name={onClock.name} size={140} color={onClock.color} square style={{ boxShadow: `0 0 60px ${onClock.color}55` }} />
            <h1 className={styles.teamName} style={{ color: onClock.color }}>{teamLabel(onClock)}</h1>
            {onClock.captain && <div className={styles.captain}>© {onClock.captain}</div>}
          </>
        )}
      </div>

      <div className={styles.counters}>
        {counters.map(({ cat, remaining }) => {
          const cs = getCategoryStyle(config, cat);
          return (
            <div key={cat} className={styles.counter} style={{ color: cs.color }}>
              <span className={styles.counterNum}>{remaining}</span>
              <span className={styles.counterLabel}>{cat} left</span>
            </div>
          );
        })}
      </div>

      <div className={styles.bottomRow}>
        <div className={styles.sideCol}>
          <span className={styles.sideLabel}>NEXT</span>
          <div className={styles.upcoming}>
            {upcoming.map((t, i) => (
              <span key={`${t.id}-${i}`} className={styles.upChip} style={{ color: t.color, borderColor: `${t.color}55` }}>{teamLabel(t)}</span>
            ))}
          </div>
        </div>
        <div className={styles.sideCol}>
          <span className={styles.sideLabel}>RECENT PICKS</span>
          {lastPicks.map(({ player, team, round }) => (
            <div key={player.id} className={styles.recentRow}>
              <span className={styles.recentR}>R{round}</span>
              <span className={styles.recentName}>{player.name}</span>
              <span className={styles.recentTeam} style={{ color: team?.color }}>{team ? teamLabel(team) : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
