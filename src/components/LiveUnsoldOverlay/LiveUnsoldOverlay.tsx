import type { Player, TournamentConfig } from '@/types';
import { getCategoryStyle } from '@/constants/auction';
import { Avatar } from '@/components/Avatar/Avatar';
import { Icon } from '@/components/Icon/Icon';
import { withAlpha } from '@/utils/color';
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
            <Icon name="arrow-down" size={36} />
          </div>
          <div className={styles.demotedText}>DEMOTED</div>
          <div className={styles.playerName}>{player.name}</div>
          <div className={styles.dividerAmber} />
          <div
            className={styles.newCat}
            style={{ '--cat-color': newCatStyle.color, '--cat-bg': newCatStyle.bg, '--cat-border': withAlpha(newCatStyle.color, 0.25) } as React.CSSProperties}
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
            <Icon name="arrow-down" size={36} />
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
            style={{ '--cat-color': catStyle.color, '--cat-bg': catStyle.bg, '--cat-border': withAlpha(catStyle.color, 0.25) } as React.CSSProperties}
          >
            {player.category}
          </span>
          <span className={styles.basePrice}>Base {player.basePrice} pts</span>
        </div>

      </div>
    </div>
  );
}
