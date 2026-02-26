import type { TournamentConfig } from '@/types';
import { getCategoryStyle } from '@/constants/auction';
import styles from './LiveUnsoldOverlay.module.css';

interface LiveUnsoldOverlayProps {
  playerName: string;
  demoted: boolean;
  newCategory?: string;
  halvedInPlace?: boolean;
  config: TournamentConfig;
}

export function LiveUnsoldOverlay({ playerName, demoted, newCategory, halvedInPlace, config }: LiveUnsoldOverlayProps) {
  if (demoted && newCategory) {
    const catStyle = getCategoryStyle(config, newCategory);
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.demotedIcon} aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </div>
          <div className={styles.demotedText}>DEMOTED</div>
          <div className={styles.playerName}>{playerName}</div>
          <div className={styles.newCat} style={{ color: catStyle.color, borderColor: `${catStyle.color}40`, background: catStyle.bg }}>
            Moved to {newCategory} Category
          </div>
        </div>
      </div>
    );
  }

  if (halvedInPlace) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.demotedIcon} aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </div>
          <div className={styles.demotedText}>BASE PRICE HALVED</div>
          <div className={styles.playerName}>{playerName}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.unsoldText}>UNSOLD</div>
        <div className={styles.playerName}>{playerName}</div>
      </div>
    </div>
  );
}
