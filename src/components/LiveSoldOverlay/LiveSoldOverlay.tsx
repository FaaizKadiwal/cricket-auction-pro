import { useMemo } from 'react';
import type { SoldPayload } from '@/types/live';
import { CATEGORY_STYLE } from '@/constants/auction';
import { formatPts } from '@/utils/format';
import { Avatar } from '@/components/Avatar/Avatar';
import styles from './LiveSoldOverlay.module.css';

interface LiveSoldOverlayProps {
  lastSold: SoldPayload;
}

// Pre-defined particle positions for deterministic burst effect
const PARTICLES = [
  { tx: '-80px', ty: '-100px', color: '#00ff88', delay: '0s' },
  { tx: '90px',  ty: '-85px',  color: '#00d4ff', delay: '0.05s' },
  { tx: '-110px', ty: '30px',  color: '#ffd700', delay: '0.1s' },
  { tx: '100px', ty: '50px',   color: '#00ff88', delay: '0.08s' },
  { tx: '-50px', ty: '-120px', color: '#ff6b9d', delay: '0.12s' },
  { tx: '70px',  ty: '-110px', color: '#00d4ff', delay: '0.03s' },
  { tx: '-90px', ty: '70px',   color: '#ffd700', delay: '0.15s' },
  { tx: '120px', ty: '-20px',  color: '#00ff88', delay: '0.07s' },
  { tx: '-60px', ty: '100px',  color: '#ff6b9d', delay: '0.11s' },
  { tx: '40px',  ty: '110px',  color: '#00d4ff', delay: '0.06s' },
];

export function LiveSoldOverlay({ lastSold }: LiveSoldOverlayProps) {
  const catStyle = CATEGORY_STYLE[lastSold.player.category];

  const particles = useMemo(() =>
    PARTICLES.map((p, i) => (
      <span
        key={i}
        className={styles.particle}
        style={{
          '--tx': p.tx,
          '--ty': p.ty,
          '--delay': p.delay,
          background: p.color,
        } as React.CSSProperties}
      />
    )), [],
  );

  return (
    <div className={styles.overlay}>
      {/* Left team logo — slam in from left */}
      <div
        className={styles.sideLogoLeft}
        style={{ '--team-glow': lastSold.teamColor } as React.CSSProperties}
      >
        <Avatar
          src={lastSold.teamLogoBase64}
          name={lastSold.teamName}
          size={120}
          color={lastSold.teamColor}
          square
          className={styles.sideLogoImg}
          style={{ border: `3px solid ${lastSold.teamColor}` }}
        />
      </div>

      {/* Right team logo — slam in from right */}
      <div
        className={styles.sideLogoRight}
        style={{ '--team-glow': lastSold.teamColor } as React.CSSProperties}
      >
        <Avatar
          src={lastSold.teamLogoBase64}
          name={lastSold.teamName}
          size={120}
          color={lastSold.teamColor}
          square
          className={styles.sideLogoImg}
          style={{ border: `3px solid ${lastSold.teamColor}` }}
        />
      </div>

      {/* SOLD stamp with particles */}
      <div className={styles.stampArea}>
        {particles}
        <div className={styles.soldText}>SOLD</div>
      </div>

      {/* Player info */}
      <div className={styles.playerRow}>
        <Avatar
          src={lastSold.player.photoBase64}
          name={lastSold.player.name}
          size={80}
          color={catStyle.color}
          style={{ border: `3px solid ${catStyle.color}` }}
        />
        <div className={styles.playerInfo}>
          <span className={styles.playerName}>{lastSold.player.name}</span>
          <span className={styles.playerCat} style={{ color: catStyle.color }}>{lastSold.player.category}</span>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Winning team */}
      <div className={styles.teamRow}>
        <Avatar
          src={lastSold.teamLogoBase64}
          name={lastSold.teamName}
          size={64}
          color={lastSold.teamColor}
          square
        />
        <span className={styles.teamName} style={{ color: lastSold.teamColor }}>{lastSold.teamName}</span>
      </div>

      {/* Final price */}
      <div className={styles.priceTag}>
        <span className={styles.priceLabel}>FINAL PRICE</span>
        <span className={styles.priceValue}>{formatPts(lastSold.finalPrice)} PTS</span>
      </div>
    </div>
  );
}
