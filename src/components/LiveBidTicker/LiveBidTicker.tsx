import { MAX_VISIBLE_BIDS } from '@/constants/auction';
import { formatPts } from '@/utils/format';
import styles from './LiveBidTicker.module.css';

interface LiveBidTickerProps {
  log: Array<{ teamName: string; teamColor: string; bid: number }>;
}

export function LiveBidTicker({ log }: LiveBidTickerProps) {
  if (log.length === 0) return null;

  const visible = log.slice(0, MAX_VISIBLE_BIDS);

  return (
    <div className={styles.ticker} role="log" aria-label="Bid history">
      {visible.map((entry, i) => (
        <div
          key={`${entry.bid}-${entry.teamName}-${i}`}
          className={styles.entry}
          style={{
            borderColor: `${entry.teamColor}60`,
            animationDelay: `${i * 0.05}s`,
          }}
        >
          <span className={styles.teamDot} style={{ background: entry.teamColor }} />
          <span className={styles.teamName} style={{ color: entry.teamColor }}>{entry.teamName}</span>
          <span className={styles.bid}>{formatPts(entry.bid)}</span>
        </div>
      ))}
    </div>
  );
}
