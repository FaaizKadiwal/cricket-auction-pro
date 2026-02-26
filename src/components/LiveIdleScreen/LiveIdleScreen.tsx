import { useMemo } from 'react';
import type { TournamentConfig, Team, SoldPlayer } from '@/types';
import { getSquadSize } from '@/constants/auction';
import { Avatar } from '@/components/Avatar/Avatar';
import styles from './LiveIdleScreen.module.css';

interface LiveIdleScreenProps {
  config: TournamentConfig;
  soldPlayers: SoldPlayer[];
  teams: Team[];
}

export function LiveIdleScreen({ config, soldPlayers, teams }: LiveIdleScreenProps) {
  const squadSize = getSquadSize(config);
  const totalSlots = config.totalTeams * squadSize;

  const stats = useMemo(() => ({
    sold: soldPlayers.length,
    total: totalSlots,
    teamCount: teams.length,
    totalSpent: soldPlayers.reduce((s, p) => s + p.finalPrice, 0),
  }), [soldPlayers, totalSlots, teams.length]);

  return (
    <div className={styles.container}>
      {/* Logo with breathing glow */}
      <div className={styles.logoWrapper}>
        <div className={styles.logoGlow} aria-hidden="true" />
        {config.logoBase64 ? (
          <Avatar
            src={config.logoBase64}
            name={config.tournamentName}
            size={180}
            square
            className={styles.logo}
          />
        ) : (
          <div className={styles.logoFallback} aria-hidden="true">🏏</div>
        )}
      </div>

      {/* Tournament name */}
      <h1 className={styles.title}>{config.tournamentName}</h1>

      {/* Auction stats */}
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.sold}</span>
          <span className={styles.statLabel}>of {stats.total} Sold</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.teamCount}</span>
          <span className={styles.statLabel}>Teams</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.totalSpent.toLocaleString()}</span>
          <span className={styles.statLabel}>Points Spent</span>
        </div>
      </div>
    </div>
  );
}
