import { useEffect, useMemo, useState } from 'react';
import type { Team, Player } from '@/types';
import { getSquadSize, getCategoryStyle } from '@/constants/auction';
import { getPickContext, generatePickOrder, getRoundSchedule, getDraftAvailablePlayers } from '@/utils/draft';
import { getSquad } from '@/utils/auction';
import { teamLabel } from '@/utils/format';
import { useTournament } from '@/context/TournamentContext';
import { Avatar } from '@/components/Avatar/Avatar';
import { Icon } from '@/components/Icon/Icon';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { CategoryPills } from '@/components/CategoryPills/CategoryPills';
import type { DraftTabProps } from './DraftTab';
import styles from './DraftTab.module.css';

export function DraftBoard({ teams, players, soldPlayers, draftState, onDraftStateChange, onPick, onUndoPick, onToast, broadcast }: DraftTabProps) {
  const { config } = useTournament();
  const squadSize = getSquadSize(config);
  const T = config.totalTeams;
  const schedule = useMemo(() => getRoundSchedule(config), [config]);
  const pickOrder = useMemo(() => generatePickOrder(config, draftState.baseOrder), [config, draftState.baseOrder]);
  const pickCtx = getPickContext(config, draftState.baseOrder, soldPlayers.length);

  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<Player | null>(null);
  const [confirmingFinalize, setConfirmingFinalize] = useState(false);

  // Remaining (undrafted) players per category — spec §2.12.
  const counters = config.categories
    .filter((c) => c.draftCount > 0)
    .map((c) => ({ cat: c.name, remaining: players.filter((p) => p.status === 'pending' && p.category === c.name).length }));

  // Push the live "on the clock" board to the projector on mount and after every
  // pick/undo (Event Mode). The 3 s SYNC is the backstop if the viewer joins late.
  useEffect(() => {
    broadcast?.broadcastDraftClock();
  }, [broadcast, soldPlayers.length]);

  const onClockTeam = teams.find((t) => t.id === pickCtx.onClockTeamId) ?? null;
  const catStyle = getCategoryStyle(config, pickCtx.category);

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return getDraftAvailablePlayers(players, pickCtx.category).filter((p) => q === '' || p.name.toLowerCase().includes(q));
  }, [players, pickCtx.category, search]);

  const undo = () => {
    const u = onUndoPick();
    if (u) onToast(`Undo — ${u.name} returned to the pool`, 'warn');
  };

  // ── Draft complete ──────────────────────────────────────────────────────────
  if (pickCtx.complete) {
    return (
      <main className={styles.page} aria-label="Draft board">
        <div className={styles.completePanel} role="status">
          <div className={styles.finalIcon}><Icon name="check-circle" size={40} /></div>
          <h2 className={styles.title}>All picks complete</h2>
          <p className={styles.subtitle}>Every team has drafted a full squad of {squadSize}.</p>
          <button className={styles.primaryBtn} onClick={() => setConfirmingFinalize(true)}>
            <Icon name="check" size={14} /> Finalize Draft
          </button>
          {soldPlayers.length > 0 && (
            <button className={styles.undoBtn} onClick={undo}>
              <Icon name="undo" size={13} /> Undo Last Pick
            </button>
          )}
        </div>
        {confirmingFinalize && (
          <ConfirmDialog
            title="Finalize draft?"
            message="This locks the draft as read-only. You won't be able to change picks afterwards (results stay exportable)."
            confirmLabel="Finalize"
            tone="success"
            onConfirm={() => onDraftStateChange({ ...draftState, phase: 'finalized' })}
            onCancel={() => setConfirmingFinalize(false)}
          />
        )}
      </main>
    );
  }

  const confirmPick = () => {
    if (!pending || !onClockTeam) return;
    onPick(pending, onClockTeam.id, 0);
    onToast(`${pending.name} → ${teamLabel(onClockTeam)} (Round ${pickCtx.round})`, 'ok');
    setPending(null);
  };

  // Next few teams on the clock.
  const upcoming: Team[] = [];
  for (let i = soldPlayers.length + 1; i < soldPlayers.length + 4 && i < pickCtx.totalPicks; i++) {
    const tm = teams.find((t) => t.id === pickOrder[Math.floor(i / T)]?.[i % T]);
    if (tm) upcoming.push(tm);
  }

  // Recent picks, newest first.
  const lastPicks: { player: Player; team: Team | undefined; round: number; category: string }[] = [];
  for (let i = soldPlayers.length - 1; i >= 0 && lastPicks.length < 6; i--) {
    const r = Math.floor(i / T);
    lastPicks.push({ player: soldPlayers[i], team: teams.find((t) => t.id === soldPlayers[i].teamId), round: r + 1, category: schedule[r] });
  }

  return (
    <main className={styles.page} aria-label="Draft board">
      {/* ── On the clock ── */}
      <section className={styles.clockBar} aria-live="polite">
        <div className={styles.clockMeta}>
          <span className={styles.clockRound}>Round {pickCtx.round}<span className={styles.clockOf}>/{schedule.length}</span></span>
          <span className={styles.clockPill} style={{ color: catStyle.color, background: catStyle.bg, borderColor: `${catStyle.color}40` }}>{pickCtx.category}</span>
          <span className={styles.clockPickNum}>Pick {pickCtx.pickNumber}<span className={styles.clockOf}>/{pickCtx.totalPicks}</span></span>
        </div>

        <div className={styles.clockTeam} style={{ borderColor: onClockTeam?.color ?? 'var(--border)' }}>
          <span className={styles.clockLabel}>On the clock</span>
          {onClockTeam && (
            <div className={styles.clockTeamRow}>
              <Avatar src={onClockTeam.logoBase64} name={onClockTeam.name} size={40} color={onClockTeam.color} square />
              <div>
                <div className={styles.clockTeamName} style={{ color: onClockTeam.color }}>{teamLabel(onClockTeam)}</div>
                {onClockTeam.captain && <div className={styles.clockCaptain}>© {onClockTeam.captain}</div>}
              </div>
            </div>
          )}
        </div>

        <div className={styles.clockSide}>
          {upcoming.length > 0 && (
            <div className={styles.upcoming}>
              <span className={styles.upcomingLabel}>Next</span>
              {upcoming.map((t, i) => (
                <span key={`${t.id}-${i}`} className={styles.upcomingChip} style={{ color: t.color, borderColor: `${t.color}50` }}>{teamLabel(t)}</span>
              ))}
            </div>
          )}
          <div className={styles.clockBtns}>
            <button className={styles.undoBtn} onClick={undo} disabled={soldPlayers.length === 0}>
              <Icon name="undo" size={13} /> Undo
            </button>
            {broadcast && (
              <>
                <button className={styles.liveBtn} onClick={() => broadcast.broadcastShowSquads()} aria-label="Show squads on live viewer">
                  <Icon name="users" size={12} /> Squads
                </button>
                <button className={styles.liveBtn} onClick={() => broadcast.broadcastShowIdle()} aria-label="Show tournament logo on live viewer">
                  <Icon name="monitor" size={12} /> Logo
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Remaining players per category (spec §2.12) */}
      <div className={styles.countersRow} role="status" aria-label="Players remaining per category">
        <span className={styles.countersLabel}>Remaining</span>
        {counters.map(({ cat, remaining }) => {
          const cs = getCategoryStyle(config, cat);
          return (
            <span key={cat} className={styles.counterPill} style={{ color: cs.color, background: cs.bg, borderColor: `${cs.color}40` }}>
              {cat} <strong>{remaining}</strong>
            </span>
          );
        })}
      </div>

      <div className={styles.boardLayout}>
        {/* ── Available players ── */}
        <div className={styles.poolCard}>
          <div className={styles.poolHead}>
            <span className={styles.poolTitle}>Available {pickCtx.category} <span className={styles.poolCount}>({available.length})</span></span>
          </div>
          <input
            className={styles.poolSearch}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${pickCtx.category} players…`}
            aria-label="Search available players"
          />
          {available.length === 0 ? (
            <p className={styles.poolEmpty}>{search.trim() ? `No players match "${search.trim()}"` : `No ${pickCtx.category} players available`}</p>
          ) : (
            <ul className={styles.poolList}>
              {available.map((p) => (
                <li key={p.id} className={styles.poolRow}>
                  <Avatar src={p.photoBase64} name={p.name} size={32} color={catStyle.color} />
                  <div className={styles.poolInfo}>
                    <span className={styles.poolName}>{p.name}</span>
                    {p.description && <span className={styles.poolDesc}>{p.description}</span>}
                  </div>
                  <button className={styles.pickBtn} onClick={() => setPending(p)} style={{ borderColor: onClockTeam?.color, color: onClockTeam?.color }}>
                    <Icon name="check" size={13} /> Draft
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Sidebar: progress + last picks ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sideCard}>
            <div className={styles.sideTitle}>Team Progress</div>
            {teams.map((team) => {
              const drafted = getSquad(team.id, soldPlayers).length;
              const isClock = team.id === pickCtx.onClockTeamId;
              return (
                <div key={team.id} className={`${styles.progRow} ${isClock ? styles.progRowClock : ''}`} style={{ borderLeftColor: team.color }}>
                  <span className={styles.progName} style={{ color: team.color }}>{teamLabel(team)}</span>
                  <span className={styles.progCount}>{drafted}/{squadSize}</span>
                  <div className={styles.progPills}><CategoryPills teamId={team.id} soldPlayers={soldPlayers} config={config} /></div>
                </div>
              );
            })}
          </div>

          {lastPicks.length > 0 && (
            <div className={styles.sideCard}>
              <div className={styles.sideTitle}>Recent Picks</div>
              {lastPicks.map(({ player, team, round, category }) => (
                <div key={player.id} className={styles.recentRow}>
                  <span className={styles.recentR}>R{round}</span>
                  <span className={styles.recentName}>{player.name}</span>
                  <span className={styles.recentTeam} style={{ color: team?.color }}>{team ? teamLabel(team) : ''}</span>
                  <span className={styles.recentCat} style={{ color: getCategoryStyle(config, category).color }}>{category[0]}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* ── Schedule matrix ── */}
      <section className={styles.matrixCard}>
        <div className={styles.sideTitle}>Draft Schedule</div>
        <div className={styles.matrixWrap}>
          <table className={styles.matrix}>
            <thead>
              <tr>
                <th scope="col" className={styles.matrixCorner}>Rnd</th>
                {Array.from({ length: T }, (_, p) => <th key={p} scope="col">P{p + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              {pickOrder.map((round, r) => (
                <tr key={r}>
                  <th scope="row" className={styles.matrixRnd} style={{ color: getCategoryStyle(config, schedule[r]).color }}>
                    {r + 1}<span className={styles.matrixCat}>{schedule[r][0]}</span>
                  </th>
                  {round.map((tid, pos) => {
                    const globalIdx = r * T + pos;
                    const team = teams.find((t) => t.id === tid);
                    const state = globalIdx < soldPlayers.length ? 'done' : globalIdx === soldPlayers.length ? 'current' : 'upcoming';
                    return (
                      <td
                        key={pos}
                        className={`${styles.matrixCell} ${state === 'done' ? styles.mDone : state === 'current' ? styles.mCurrent : ''}`}
                        style={{ '--cell-color': team?.color ?? 'var(--muted)' } as React.CSSProperties}
                        title={team ? teamLabel(team) : ''}
                      >
                        {team ? teamLabel(team) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {pending && onClockTeam && (
        <ConfirmDialog
          title="Confirm Pick"
          message={
            <>Draft <strong style={{ color: 'var(--text)' }}>{pending.name}</strong> ({pickCtx.category}) to{' '}
            <strong style={{ color: onClockTeam.color }}>{teamLabel(onClockTeam)}</strong>?</>
          }
          confirmLabel="Confirm Pick"
          tone="success"
          onConfirm={confirmPick}
          onCancel={() => setPending(null)}
        />
      )}
    </main>
  );
}
