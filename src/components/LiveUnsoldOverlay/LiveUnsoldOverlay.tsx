import { CATEGORY_STYLE } from '@/constants/auction';
import type { Category } from '@/types';
import styles from './LiveUnsoldOverlay.module.css';

interface LiveUnsoldOverlayProps {
  playerName: string;
  demoted: boolean;
  newCategory?: string;
}

export function LiveUnsoldOverlay({ playerName, demoted, newCategory }: LiveUnsoldOverlayProps) {
  if (demoted && newCategory) {
    const catStyle = CATEGORY_STYLE[newCategory as Category];
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

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.unsoldText}>UNSOLD</div>
        <div className={styles.playerName}>{playerName}</div>
      </div>
    </div>
  );
}
