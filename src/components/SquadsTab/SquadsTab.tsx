import { useMemo } from 'react';
import type { Team, SoldPlayer, Category } from '@/types';
import { CATEGORY_STYLE, CATEGORIES } from '@/constants/auction';
import { getSquad, getSpent, getCatCount } from '@/utils/auction';
import { formatPts } from '@/utils/format';
import { useTournament } from '@/context/TournamentContext';
import { Avatar } from '@/components/Avatar/Avatar';
import styles from './SquadsTab.module.css';

// ─── TeamSquadCard ────────────────────────────────────────────────────────────

interface TeamSquadCardProps {
  team: Team;
  soldPlayers: SoldPlayer[];
}

function TeamSquadCard({ team, soldPlayers }: TeamSquadCardProps) {
  const { config } = useTournament();
  const squadSize  = config.playersPerTeam - 1;

  const squad   = useMemo(() => getSquad(team.id, soldPlayers), [team.id, soldPlayers]);
  const spent   = useMemo(() => getSpent(team.id, soldPlayers), [team.id, soldPlayers]);
  const remain  = config.budget - spent;

  // +1 for captain
  const total      = squad.length + 1;
  const isComplete = squad.length >= squadSize;

  return (
    <article
      className={styles.card}
      aria-label={`${team.name || `Team ${team.id}`} squad`}
      style={{ borderTop: `3px solid ${team.color}` }}
    >
      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.teamMeta}>
          {/* Team logo */}
          <Avatar
            src={team.logoBase64}
            name={team.name}
            size={52}
            color={team.color}
            square
          />

          <div className={styles.teamText}>
            <div className={styles.teamName} style={{ color: team.color }}>
              {team.name || `Team ${team.id}`}
            </div>

            {/* Captain row */}
            <div className={styles.captainRow}>
              <Avatar
                src={team.captainBase64}
                name={team.captain}
                size={20}
                color={team.color}
              />
              <span className={styles.captainName}>{team.captain || '—'}</span>
              <span className={styles.captainTag}>★ CPT</span>
            </div>
          </div>
        </div>

        {/* Size badge */}
        <div className={styles.sizeBadge}>
          <div
            className={styles.sizeNum}
            style={{ color: isComplete ? 'var(--success)' : 'var(--warning)' }}
          >
            {total}/{config.playersPerTeam}
          </div>
          <div className={styles.sizeLabel}>players</div>
        </div>
      </div>

      {/* Player list */}
      <div className={styles.playerList}>
        {/* Captain row (always shown) */}
        <div className={`${styles.playerRow} ${styles.captainPlayerRow}`}>
          <div className={styles.playerLeft}>
            <Avatar
              src={team.captainBase64}
              name={team.captain}
              size={28}
              color={team.color}
            />
            <span className={styles.playerNameText}>{team.captain || '—'}</span>
            <span className={styles.captainTag}>★</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>Captain</span>
        </div>

        {squad.length === 0 ? (
          <div className={styles.emptyNote}>No players acquired yet</div>
        ) : (
          squad.map((p) => {
            const { color } = CATEGORY_STYLE[p.category];
            return (
              <div key={p.id} className={styles.playerRow}>
                <div className={styles.playerLeft}>
                  <Avatar
                    src={p.photoBase64}
                    name={p.name}
                    size={28}
                    color={color}
                  />
                  <div className={styles.catPip} style={{ background: color }} aria-hidden="true" />
                  <span className={styles.playerNameText}>{p.name}</span>
                </div>
                <span className={styles.playerPrice}>{formatPts(p.finalPrice)}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className={styles.cardFooter}>
        <div className={styles.footerStat}>
          <span className={styles.footerLabel}>Spent</span>
          <span className={styles.footerValue} style={{ color: 'var(--danger)' }}>
            {formatPts(spent)}
          </span>
        </div>
        <div className={styles.footerStat}>
          <span className={styles.footerLabel}>Remaining</span>
          <span className={styles.footerValue} style={{ color: 'var(--success)' }}>
            {formatPts(remain)}
          </span>
        </div>

        {/* Category breakdown */}
        <div className={styles.catRow}>
          {CATEGORIES.map((cat) => {
            const max = config.categoryLimits[cat]?.max ?? 0;
            const cnt = getCatCount(team.id, cat, soldPlayers);
            return (
              <span
                key={cat}
                className={styles.catPill}
                style={{
                  background: `${CATEGORY_STYLE[cat].color}18`,
                  color:      CATEGORY_STYLE[cat].color,
                  border:     `1px solid ${CATEGORY_STYLE[cat].color}35`,
                }}
              >
                {cat[0]}: {cnt}{max > 0 ? `/${max}` : ''}
              </span>
            );
          })}
        </div>
      </div>
    </article>
  );
}

// ─── SquadsTab ────────────────────────────────────────────────────────────────

interface SquadsTabProps {
  teams: Team[];
  soldPlayers: SoldPlayer[];
}

export function SquadsTab({ teams, soldPlayers }: SquadsTabProps) {
  const { config } = useTournament();

  return (
    <main className={styles.page} aria-label="Final squads overview">
      <h1 className={styles.pageTitle}>Final Squads</h1>
      <p className={styles.pageSubtitle}>
        Complete roster and budget overview for all {config.totalTeams} teams
      </p>
      <div className={styles.grid}>
        {teams.map((team) => (
          <TeamSquadCard key={team.id} team={team} soldPlayers={soldPlayers} />
        ))}
      </div>
    </main>
  );
}
