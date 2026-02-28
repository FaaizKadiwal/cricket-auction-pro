import type { TournamentConfig } from '@/types';
import styles from './LogoTransition.module.css';

interface LogoTransitionProps {
  config: TournamentConfig;
}

export function LogoTransition({ config }: LogoTransitionProps) {
  return (
    <div className={styles.container}>
      <div className={styles.ring} aria-hidden="true" />
      <div className={styles.ringOuter} aria-hidden="true" />
      <div className={styles.logoWrap}>
        {config.logoBase64 ? (
          <img src={config.logoBase64} alt={config.tournamentName} className={styles.logo} />
        ) : (
          <div className={styles.logoFallback}>🏏</div>
        )}
      </div>
      <div className={styles.dots}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    </div>
  );
}
