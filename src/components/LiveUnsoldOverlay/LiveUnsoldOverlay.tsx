import type { Player, TournamentConfig } from '@/types';
import { getCategoryStyle } from '@/constants/auction';
import { Avatar } from '@/components/Avatar/Avatar';
import styles from './LiveUnsoldOverlay.module.css';

interface LiveUnsoldOverlayProps {
  player: Player;
  demoted: boolean;
  newCategory?: string;
  halvedInPlace?: boolean;
  config: TournamentConfig;
}

export function LiveUnsoldOverlay({ player, demoted, newCategory, halvedInPlace, config }: LiveUnsoldOverlayProps) {
  const catStyle = getCategoryStyle(config, player.category);

  // ── Demoted ────────────────────────────────────────────────────────────────
  if (demoted && newCategory) {
    const newCatStyle = getCategoryStyle(config, newCategory);
    return (
      <div className={styles.container}>
        <div className={`${styles.bgGlow} ${styles.bgGlowAmber}`} aria-hidden="true" />
        <div className={styles.content}>
          <div className={`${styles.avatarWrap} ${styles.avatarWrapAmber}`}>
            <Avatar src={player.photoBase64} name={player.name} size={120} color="var(--warning)" />
          </div>
          <div className={styles.demotedIcon} aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </div>
          <div className={styles.demotedText}>DEMOTED</div>
          <div className={styles.playerName}>{player.name}</div>
          <div className={styles.dividerAmber} />
          <div
            className={styles.newCat}
            style={{ '--cat-color': newCatStyle.color, '--cat-bg': newCatStyle.bg, '--cat-border': newCatStyle.color + '40' } as React.CSSProperties}
          >
            Moved to {newCategory} Category
          </div>
        </div>
      </div>
    );
  }

  // ── Halved in place ────────────────────────────────────────────────────────
  if (halvedInPlace) {
    return (
      <div className={styles.container}>
        <div className={`${styles.bgGlow} ${styles.bgGlowAmber}`} aria-hidden="true" />
        <div className={styles.content}>
          <div className={`${styles.avatarWrap} ${styles.avatarWrapAmber}`}>
            <Avatar src={player.photoBase64} name={player.name} size={120} color="var(--warning)" />
          </div>
          <div className={styles.demotedIcon} aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </div>
          <div className={styles.demotedText}>BASE PRICE HALVED</div>
          <div className={styles.playerName}>{player.name}</div>
        </div>
      </div>
    );
  }

  // ── Plain UNSOLD ───────────────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      <div className={styles.bgGlow}    aria-hidden="true" />
      <div className={styles.rays}      aria-hidden="true" />
      <div className={styles.content}>

        <div className={styles.avatarWrap}>
          <Avatar
            src={player.photoBase64}
            name={player.name}
            size={130}
            color="var(--danger)"
          />
        </div>

        <div className={styles.unsoldStamp}>UNSOLD</div>

        <div className={styles.playerName}>{player.name}</div>

        <div className={styles.divider} />

        <div className={styles.metaRow}>
          <span
            className={styles.catBadge}
            style={{ '--cat-color': catStyle.color, '--cat-bg': catStyle.bg, '--cat-border': catStyle.color + '40' } as React.CSSProperties}
          >
            {player.category}
          </span>
          <span className={styles.basePrice}>Base {player.basePrice} pts</span>
        </div>

      </div>
    </div>
  );
}
