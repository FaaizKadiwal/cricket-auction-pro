import { useMemo } from 'react';
import type { TournamentConfig, Team, SoldPlayer } from '@/types';
import { getTotalSlots, getMode } from '@/constants/auction';
import { getTotalSpent } from '@/utils/auction';
import styles from './LiveIdleScreen.module.css';

interface LiveIdleScreenProps {
  config: TournamentConfig;
  soldPlayers: SoldPlayer[];
  teams: Team[];
}

export function LiveIdleScreen({ config, soldPlayers, teams }: LiveIdleScreenProps) {
  const isDraft = getMode(config) === 'draft';
  const totalSlots = getTotalSlots(config);

  const stats = useMemo(() => ({
    sold: soldPlayers.length,
    total: totalSlots,
    teamCount: teams.length,
    totalSpent: getTotalSpent(soldPlayers),
  }), [soldPlayers, totalSlots, teams.length]);

  return (
    <div className={styles.container}>
      {/* Logo with breathing glow */}
      <div className={styles.logoWrapper}>
        <div className={styles.logoGlow} aria-hidden="true" />
        {config.logoBase64 ? (
          <img src={config.logoBase64} alt={config.tournamentName} className={styles.logo} />
        ) : (
          <div className={styles.logoFallback} aria-hidden="true">🏏</div>
        )}
      </div>

      {/* Tournament name */}
      <h1 className={styles.title}>{config.tournamentName}</h1>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.sold}</span>
          <span className={styles.statLabel}>of {stats.total} {isDraft ? 'Drafted' : 'Sold'}</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.teamCount}</span>
          <span className={styles.statLabel}>Teams</span>
        </div>
        {!isDraft && (
          <>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>{stats.totalSpent.toLocaleString()}</span>
              <span className={styles.statLabel}>Points Spent</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
