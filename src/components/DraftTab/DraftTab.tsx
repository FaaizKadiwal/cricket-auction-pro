import { useEffect, useMemo, useState } from 'react';
import type { Team, Player, SoldPlayer } from '@/types';
import type { DraftState } from '@/types/draft';
import type { BroadcastHandle } from '@/hooks/useBroadcast';
import { getSquadSize, getCategoryStyle, getTotalSlots } from '@/constants/auction';
import {
  getRoundSchedule, getSlotFairness, getFairnessSpread, canUseBalancedGrid,
  makeSeed, shuffleTeams, assignCaptainsToTeams, getDraftSetupErrors,
  getCaptainDrawErrors, getDraftReadiness,
} from '@/utils/draft';
import { teamLabel } from '@/utils/format';
import { buildDraftCsv, buildDraftJson, downloadFile } from '@/utils/export';
import { useTournament } from '@/context/TournamentContext';
import { Avatar } from '@/components/Avatar/Avatar';
import { Icon } from '@/components/Icon/Icon';
import { CategoryPills } from '@/components/CategoryPills/CategoryPills';
import { DraftBoard } from './DraftBoard';
import styles from './DraftTab.module.css';

export interface DraftTabProps {
  teams: Team[];
  players: Player[];
  soldPlayers: SoldPlayer[];
  draftState: DraftState;
  onDraftStateChange: (s: DraftState) => void;
  /** Write the captain→team assignment back to the teams (captain draw phase). */
  onTeamsChange: (teams: Team[]) => void;
  /** Reuses App.handleSell — a drafted player is a SoldPlayer with finalPrice 0. */
  onPick: (player: Player, teamId: number, finalPrice: number) => void;
  onUndoPick: () => SoldPlayer | null;
  onToast: (msg: string, type: 'ok' | 'warn') => void;
  broadcast?: BroadcastHandle;
}

export function DraftTab(props: DraftTabProps) {
  switch (props.draftState.phase) {
    case 'captains':  return <CaptainScreen {...props} />;
    case 'order':     return <OrderScreen {...props} />;
    case 'preview':   return <PreviewScreen {...props} />;
    case 'drafting':  return <DraftBoard {...props} />;
    case 'finalized': return <FinalizedScreen {...props} />;
    default:          return null;
  }
}

// ─── Captain Assignment Screen (spec §2.4) ────────────────────────────────────

function CaptainScreen({ teams, players, draftState, onDraftStateChange, onTeamsChange, onToast }: DraftTabProps) {
  const { config } = useTournament();
  // The draw only needs franchises + captains named — an unfinished player pool
  // must NOT block this ceremony (the pool is gated later, at Start Draft).
  const drawErrors = useMemo(() => getCaptainDrawErrors(teams), [teams]);
  const poolShortfalls = useMemo(() => getDraftReadiness(config, players), [config, players]);
  const [assigned, setAssigned] = useState<Team[] | null>(null);
  const [seed, setSeed] = useState('');
  const canDraw = drawErrors.length === 0;

  // A drawn-but-unconfirmed pairing goes stale if the roster changes underneath
  // it (e.g. team count edited in the config modal while this screen stays
  // mounted). Reset the reveal so a stale draw can never overwrite fresh teams.
  const teamIdsKey = teams.map((t) => t.id).join(',');
  useEffect(() => { setAssigned(null); setSeed(''); }, [teamIdsKey]);

  const draw = () => {
    if (!canDraw) { onToast('Name every franchise and captain before drawing.', 'warn'); return; }
    const s = makeSeed();
    setSeed(s);
    setAssigned(assignCaptainsToTeams(teams, s));
  };
  const confirm = () => {
    if (!assigned) { onToast('Draw the captains first.', 'warn'); return; }
    // Safety net alongside the reset effect above: never commit a draw whose
    // team list no longer matches the current roster.
    if (assigned.length !== teams.length || assigned.some((a, i) => a.id !== teams[i].id)) {
      setAssigned(null); setSeed('');
      onToast('Teams changed since the draw — draw again.', 'warn');
      return;
    }
    onTeamsChange(assigned);
    onDraftStateChange({ ...draftState, phase: 'order', captainSeed: seed });
  };

  const shown = assigned ?? teams;

  return (
    <main className={styles.page} aria-label="Captain assignment">
      <div className={styles.header}>
        <h1 className={styles.title}>Captain Assignment</h1>
        <p className={styles.subtitle}><strong>Draw Captains</strong> randomly pairs every captain with a franchise in one fair, recorded draw (re-draw as often as you like). <strong>Confirm Captains</strong> locks the pairing and moves on to the draft order.</p>
      </div>

      {drawErrors.length > 0 && (
        <div className={styles.warnBanner} role="alert">
          <Icon name="alert-triangle" size={14} />
          <span>Before captains can be drawn: {drawErrors.join(' ')}</span>
        </div>
      )}

      {drawErrors.length === 0 && poolShortfalls.length > 0 && (
        <div className={styles.infoNote} role="note">
          <Icon name="alert-circle" size={14} />
          <span>
            Player pool still short: {poolShortfalls.map((s) => `${s.category} ${s.have}/${s.need}`).join(', ')}.
            {' '}That doesn't block the captain draw — but the pool must be complete before the draft starts.
          </span>
        </div>
      )}

      <div className={styles.orderActions}>
        <button className={styles.shuffleBtn} onClick={draw} disabled={!canDraw}>
          <Icon name="refresh" size={15} /> {assigned ? 'Re-draw Captains' : 'Draw Captains'}
        </button>
        {seed && <span className={styles.seedNote}>seed <code>{seed}</code></span>}
      </div>

      <div className={styles.captainGrid}>
        {shown.map((team, i) => (
          <div
            key={team.id}
            className={`${styles.captainCard} ${assigned ? styles.captainReveal : ''}`}
            style={{ borderTopColor: team.color, animationDelay: `${i * 0.08}s` } as React.CSSProperties}
          >
            <div className={styles.captainTeam} style={{ color: team.color }}>{teamLabel(team)}</div>
            <div className={styles.captainRow}>
              <Avatar src={assigned ? team.captainBase64 : null} name={assigned ? team.captain : '?'} size={44} color={team.color} />
              <span className={styles.captainName}>{assigned ? (team.captain || '—') : 'awaiting draw'}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.footerBar}>
        <button className={styles.primaryBtn} onClick={confirm} disabled={!assigned}>
          Confirm Captains <Icon name="arrow-down" size={14} style={{ transform: 'rotate(-90deg)' }} />
        </button>
      </div>
    </main>
  );
}

// ─── Order Screen ─────────────────────────────────────────────────────────────

function OrderScreen({ teams, players, draftState, onDraftStateChange, onToast }: DraftTabProps) {
  const { config } = useTournament();
  // Like the captain draw, the order shuffle only needs named teams — the
  // player pool is enforced at Start Draft, not here.
  const drawErrors = useMemo(() => getCaptainDrawErrors(teams), [teams]);
  const poolShortfalls = useMemo(() => getDraftReadiness(config, players), [config, players]);
  const ordered = useMemo(
    () => draftState.baseOrder.map((id) => teams.find((t) => t.id === id)).filter((t): t is Team => !!t),
    [draftState.baseOrder, teams]
  );
  const hasShuffled = draftState.seed !== '';

  const shuffle = () => {
    const seed = makeSeed();
    const baseOrder = shuffleTeams(teams.map((t) => t.id), seed);
    onDraftStateChange({ ...draftState, baseOrder, seed });
  };

  const confirm = () => {
    if (drawErrors.length > 0) { onToast('Fix the setup issues before continuing.', 'warn'); return; }
    if (!hasShuffled) { onToast('Shuffle the draft order before continuing.', 'warn'); return; }
    onDraftStateChange({ ...draftState, phase: 'preview' });
  };

  return (
    <main className={styles.page} aria-label="Draft order">
      <div className={styles.header}>
        <h1 className={styles.title}>Draft Order</h1>
        <p className={styles.subtitle}>Randomly shuffle the teams into the base pick order. This is the only chance to re-draw — it locks once you continue.</p>
      </div>

      {drawErrors.length > 0 && (
        <div className={styles.warnBanner} role="alert">
          <Icon name="alert-triangle" size={14} />
          <span>Before the order can be confirmed: {drawErrors.join(' ')}</span>
        </div>
      )}

      {drawErrors.length === 0 && poolShortfalls.length > 0 && (
        <div className={styles.infoNote} role="note">
          <Icon name="alert-circle" size={14} />
          <span>
            Player pool still short: {poolShortfalls.map((s) => `${s.category} ${s.have}/${s.need}`).join(', ')}.
            {' '}You can lock the order now — the pool must be complete before the draft starts.
          </span>
        </div>
      )}

      <div className={styles.orderActions}>
        <button className={styles.shuffleBtn} onClick={shuffle}>
          <Icon name="refresh" size={15} /> {hasShuffled ? 'Re-shuffle Order' : 'Shuffle Draft Order'}
        </button>
        {hasShuffled && <span className={styles.seedNote}>seed <code>{draftState.seed}</code></span>}
      </div>

      <div className={styles.orderGrid}>
        {ordered.map((team, i) => (
          <div key={team.id} className={styles.slotCard} style={{ borderLeftColor: team.color }}>
            <span className={styles.slotNum}>S{i + 1}</span>
            <Avatar src={team.logoBase64} name={team.name} size={34} color={team.color} square />
            <span className={styles.slotTeam} style={{ color: team.color }}>{teamLabel(team)}</span>
            {!hasShuffled && <span className={styles.slotPending}>not shuffled</span>}
          </div>
        ))}
      </div>

      <div className={styles.footerBar}>
        <button className={styles.primaryBtn} onClick={confirm} disabled={!hasShuffled || drawErrors.length > 0}>
          Confirm Order <Icon name="arrow-down" size={14} style={{ transform: 'rotate(-90deg)' }} />
        </button>
      </div>
    </main>
  );
}

// ─── Preview Screen (schedule + fairness) ─────────────────────────────────────

function PreviewScreen({ teams, players, draftState, onDraftStateChange, onToast }: DraftTabProps) {
  const { config } = useTournament();
  const schedule = useMemo(() => getRoundSchedule(config), [config]);
  const fairness = useMemo(() => getSlotFairness(config, draftState.baseOrder), [config, draftState.baseOrder]);
  const spread = getFairnessSpread(fairness);
  const usingGrid = canUseBalancedGrid(config);
  const catNames = config.categories.filter((c) => c.draftCount > 0).map((c) => c.name);
  // THIS is where the full roster gate lives — drafting needs a complete pool.
  const setupErrors = useMemo(() => getDraftSetupErrors(config, teams, players), [config, teams, players]);

  const teamOf = (id: number) => teams.find((t) => t.id === id) ?? null;

  const startDraft = () => {
    // Re-validate — the pool could have changed since this screen rendered.
    const errs = getDraftSetupErrors(config, teams, players);
    if (errs.length) { onToast(`Can't start: ${errs.join(' ')}`, 'warn'); return; }
    onDraftStateChange({ ...draftState, phase: 'drafting' });
  };

  return (
    <main className={styles.page} aria-label="Draft preview">
      <div className={styles.header}>
        <h1 className={styles.title}>Draft Preview</h1>
        <p className={styles.subtitle}>Review the locked order, the round schedule, and the fairness of the draw before starting.</p>
      </div>

      {setupErrors.length > 0 && (
        <div className={styles.warnBanner} role="alert">
          <Icon name="alert-triangle" size={14} />
          <span>Before the draft can start: {setupErrors.join(' ')} Complete the pool in the Setup tab.</span>
        </div>
      )}

      <div className={styles.fairBadge} data-tone={spread <= 1 ? 'ok' : 'warn'}>
        <Icon name={usingGrid ? 'shield-check' : 'scale'} size={14} />
        {usingGrid
          ? 'Balanced Custom Grid — mathematically optimal (overall spread ' + spread + ')'
          : `Snake draft — overall pick-position spread ${spread}`}
      </div>

      {/* Captains → teams (drawn) */}
      <section className={styles.previewSection}>
        <h2 className={styles.sectionTitle}>Captains</h2>
        <div className={styles.captainRowPreview}>
          {teams.map((team) => (
            <div key={team.id} className={styles.captainChip} style={{ borderColor: `${team.color}55` }}>
              <Avatar src={team.captainBase64} name={team.captain} size={24} color={team.color} />
              <span className={styles.captainChipCap}>{team.captain || '—'}</span>
              <span className={styles.captainChipTeam} style={{ color: team.color }}>{teamLabel(team)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Round schedule */}
      <section className={styles.previewSection}>
        <h2 className={styles.sectionTitle}>Round Schedule</h2>
        <div className={styles.roundRow}>
          {schedule.map((cat, i) => {
            const cs = getCategoryStyle(config, cat);
            return (
              <div key={i} className={styles.roundBadge} style={{ color: cs.color, background: cs.bg, borderColor: `${cs.color}40` }}>
                <span className={styles.roundNum}>R{i + 1}</span>
                {cat}
              </div>
            );
          })}
        </div>
      </section>

      {/* Fairness table */}
      <section className={styles.previewSection}>
        <h2 className={styles.sectionTitle}>Pick-Position Fairness</h2>
        <div className={styles.tableWrap}>
          <table className={styles.fairTable}>
            <thead>
              <tr>
                <th scope="col">Slot</th>
                <th scope="col">Team</th>
                {catNames.map((c) => <th key={c} scope="col">{c}</th>)}
                <th scope="col">Overall</th>
              </tr>
            </thead>
            <tbody>
              {fairness.map((f, i) => {
                const team = teamOf(f.teamId);
                return (
                  <tr key={f.teamId}>
                    <td className={styles.slotCell}>S{i + 1}</td>
                    <td style={{ color: team?.color }}>{team ? teamLabel(team) : `Team ${f.teamId}`}</td>
                    {catNames.map((c) => <td key={c} className={styles.numCell}>{f.perCategory[c] ?? 0}</td>)}
                    <td className={styles.numCell} style={{ fontWeight: 700 }}>{f.overall}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className={styles.fairNote}>Lower totals = earlier picks. A smaller spread means a fairer draw{usingGrid ? ' — this grid guarantees the theoretical minimum.' : '.'}</p>
      </section>

      <div className={styles.footerBar}>
        <button className={styles.secondaryBtn} onClick={() => onDraftStateChange({ ...draftState, phase: 'order' })}>
          ← Back to Order
        </button>
        <button className={styles.primaryBtn} onClick={startDraft} disabled={setupErrors.length > 0}>
          <Icon name="gavel" size={14} /> Start Draft
        </button>
      </div>
    </main>
  );
}

// ─── Finalized Screen ─────────────────────────────────────────────────────────

function FinalizedScreen({ teams, soldPlayers, draftState }: DraftTabProps) {
  const { config } = useTournament();
  const totalPicks = getTotalSlots(config);

  const doExport = (fmt: 'csv' | 'json') => {
    const input = { config, teams, soldPlayers, draftState, generatedAt: new Date().toISOString() };
    const base = (config.tournamentName || 'draft').replace(/[^\w-]+/g, '_') || 'draft';
    if (fmt === 'csv') downloadFile(`${base}_draft.csv`, buildDraftCsv(input), 'text/csv;charset=utf-8');
    else downloadFile(`${base}_draft.json`, buildDraftJson(input), 'application/json');
  };

  return (
    <main className={styles.page} aria-label="Draft complete">
      <div className={styles.finalHero}>
        <div className={styles.finalIcon}><Icon name="check-circle" size={44} /></div>
        <h1 className={styles.title}>Draft Complete</h1>
        <p className={styles.subtitle}>All {totalPicks} picks are in. Open the Squads tab for the full rosters.</p>
      </div>

      <div className={styles.finalStats}>
        <div className={styles.finalStat}><span className={styles.finalStatNum}>{teams.length}</span><span className={styles.finalStatLabel}>Teams</span></div>
        <div className={styles.finalStat}><span className={styles.finalStatNum}>{soldPlayers.length}</span><span className={styles.finalStatLabel}>Players drafted</span></div>
        <div className={styles.finalStat}><span className={styles.finalStatNum}>{getSquadSize(config)}</span><span className={styles.finalStatLabel}>Rounds</span></div>
      </div>

      <div className={styles.finalSquads}>
        {teams.map((team) => (
          <div key={team.id} className={styles.finalTeamCard} style={{ borderTopColor: team.color }}>
            <div className={styles.finalTeamName} style={{ color: team.color }}>{teamLabel(team)}</div>
            <div className={styles.finalPills}><CategoryPills teamId={team.id} soldPlayers={soldPlayers} config={config} /></div>
          </div>
        ))}
      </div>

      <div className={styles.lockNote}><Icon name="lock" size={12} /> The draft is finalised and locked. Results remain available to export.</div>

      <div className={styles.exportRow}>
        <span className={styles.exportLabel}>Export results</span>
        <button className={styles.secondaryBtn} onClick={() => doExport('csv')}><Icon name="list" size={14} /> CSV</button>
        <button className={styles.secondaryBtn} onClick={() => doExport('json')}><Icon name="layers" size={14} /> JSON</button>
      </div>
    </main>
  );
}
