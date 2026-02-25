import { useMemo } from 'react';
import type { TournamentConfig, Team, SoldPlayer } from '@/types';
import { CATEGORY_STYLE, CATEGORIES } from '@/constants/auction';
import { getSquad, getSpent, getCatCount } from '@/utils/auction';
import { formatPts } from '@/utils/format';
import { Avatar } from '@/components/Avatar/Avatar';
import styles from './LiveSquadView.module.css';

interface LiveSquadViewProps {
  teams: Team[];
  soldPlayers: SoldPlayer[];
  config: TournamentConfig;
}

export function LiveSquadView({ teams, soldPlayers, config }: LiveSquadViewProps) {
  const squadSize = config.playersPerTeam - 1;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>SQUAD OVERVIEW</h2>
      <div className={styles.grid}>
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} soldPlayers={soldPlayers} config={config} squadSize={squadSize} />
        ))}
      </div>
    </div>
  );
}

// ─── Team Card ──────────────────────────────────────────────────────────────

interface TeamCardProps {
  team: Team;
  soldPlayers: SoldPlayer[];
  config: TournamentConfig;
  squadSize: number;
}

function TeamCard({ team, soldPlayers, config, squadSize }: TeamCardProps) {
  const squad = useMemo(() => getSquad(team.id, soldPlayers), [team.id, soldPlayers]);
  const spent = useMemo(() => getSpent(team.id, soldPlayers), [team.id, soldPlayers]);
  const remaining = config.budget - spent;
  const slotsLeft = squadSize - squad.length;
  const isFull = slotsLeft <= 0;

  return (
    <div className={styles.card} style={{ borderTopColor: team.color }}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <Avatar src={team.logoBase64} name={team.name} size={40} color={team.color} square />
        <div className={styles.headerInfo}>
          <span className={styles.teamName} style={{ color: team.color }}>{team.name || `Team ${team.id}`}</span>
          {team.captain && (
            <span className={styles.captain}>
              <Avatar src={team.captainBase64} name={team.captain} size={16} color={team.color} />
              {team.captain}
            </span>
          )}
        </div>
        <span className={`${styles.sizeBadge} ${isFull ? styles.sizeFull : ''}`}>
          {squad.length}/{squadSize}
        </span>
      </div>

      {/* Player list */}
      <div className={styles.playerList}>
        {squad.length === 0 ? (
          <p className={styles.emptyNote}>No players acquired</p>
        ) : (
          squad.map((p) => (
            <div key={p.id} className={styles.playerRow}>
              <span className={styles.catDot} style={{ background: CATEGORY_STYLE[p.category].color }} />
              <span className={styles.pName}>{p.name}</span>
              <span className={styles.pPrice}>{formatPts(p.finalPrice)}</span>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className={styles.cardFooter}>
        <div className={styles.footerStat}>
          <span className={styles.footerLabel}>Spent</span>
          <span className={styles.footerValue} style={{ color: 'var(--danger)' }}>{formatPts(spent)}</span>
        </div>
        <div className={styles.footerStat}>
          <span className={styles.footerLabel}>Remaining</span>
          <span className={styles.footerValue} style={{ color: 'var(--success)' }}>{formatPts(remaining)}</span>
        </div>
        <div className={styles.catPills}>
          {CATEGORIES.map((cat) => {
            const max = config.categoryLimits[cat]?.max ?? 0;
            if (max <= 0) return null;
            const cnt = getCatCount(team.id, cat, soldPlayers);
            return (
              <span key={cat} className={styles.catPill} style={{ color: CATEGORY_STYLE[cat].color, borderColor: `${CATEGORY_STYLE[cat].color}40` }}>
                {cat[0]}: {cnt}/{max}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
