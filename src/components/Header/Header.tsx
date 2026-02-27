import type { TabId, SoldPlayer } from '@/types';
import { TABS } from '@/constants/auction';
import { formatPts } from '@/utils/format';
import { useTournament } from '@/context/TournamentContext';
import { Icon } from '@/components/Icon/Icon';
import styles from './Header.module.css';

interface HeaderProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  soldPlayers: SoldPlayer[];
  onReset: () => void;
  onEditConfig: () => void;
}

export function Header({ activeTab, onTabChange, soldPlayers, onReset, onEditConfig }: HeaderProps) {
  const { config, squadSize } = useTournament();
  const totalSpent = soldPlayers.reduce((sum, s) => sum + s.finalPrice, 0);
  const totalPlayers = config.totalTeams * squadSize;

  return (
    <header className={styles.header} role="banner">
      <div className={styles.logoWrap}>
        {config.logoBase64 ? (
          <img src={config.logoBase64} alt="Tournament logo" className={styles.logoImg} />
        ) : (
          <span className={styles.logoIcon} aria-hidden="true"><Icon name="trophy" size={24} /></span>
        )}
        <div>
          <div className={styles.logoText}>{config.tournamentName || 'Cricket Auction'}</div>
          <div className={styles.logoSub}>Tournament Management System</div>
        </div>
      </div>

      <nav className={styles.navTabs} role="navigation" aria-label="Main navigation">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.navTab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => onTabChange(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            <Icon name={tab.icon} size={14} />
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={styles.statsWrap} aria-live="polite">
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Sold</span>
          <span className={styles.statValue} style={{ color: 'var(--success)' }}>
            {soldPlayers.length} / {totalPlayers}
          </span>
        </div>
        <div className={styles.divider} aria-hidden="true" />
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Total Spent</span>
          <span className={styles.statValue} style={{ color: 'var(--accent)' }}>
            {formatPts(totalSpent)} pts
          </span>
        </div>
        <div className={styles.divider} aria-hidden="true" />
        <button className={styles.editConfigBtn} onClick={onEditConfig} aria-label="Edit tournament settings">
          <Icon name="pencil" size={13} /> Edit Config
        </button>
        <button className={styles.resetBtn} onClick={onReset} aria-label="Reset tournament configuration">
          <Icon name="refresh" size={13} /> Reconfigure
        </button>
      </div>
    </header>
  );
}
