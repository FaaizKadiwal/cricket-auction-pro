import { useMemo } from 'react';
import type { TournamentConfig } from '@/types';
import type { SoldPayload } from '@/types/live';
import { getCategoryStyle } from '@/constants/auction';
import { formatPts } from '@/utils/format';
import { Avatar } from '@/components/Avatar/Avatar';
import styles from './LiveSoldOverlay.module.css';

interface LiveSoldOverlayProps {
  lastSold: SoldPayload;
  config: TournamentConfig;
}

// Deterministic particle burst around SOLD stamp
const PARTICLES = [
  { tx: '-80px',  ty: '-100px', color: '#00ff88', delay: '0s'     },
  { tx: '90px',   ty: '-85px',  color: '#00d4ff', delay: '0.05s'  },
  { tx: '-110px', ty: '30px',   color: '#ffd700', delay: '0.1s'   },
  { tx: '100px',  ty: '50px',   color: '#00ff88', delay: '0.08s'  },
  { tx: '-50px',  ty: '-120px', color: '#ff6b9d', delay: '0.12s'  },
  { tx: '70px',   ty: '-110px', color: '#00d4ff', delay: '0.03s'  },
  { tx: '-90px',  ty: '70px',   color: '#ffd700', delay: '0.15s'  },
  { tx: '120px',  ty: '-20px',  color: '#00ff88', delay: '0.07s'  },
  { tx: '-60px',  ty: '100px',  color: '#ff6b9d', delay: '0.11s'  },
  { tx: '40px',   ty: '110px',  color: '#00d4ff', delay: '0.06s'  },
];

/**
 * Derive a short identity from the team name for the welcome message.
 * "Karachi Kings" → "KINGS"   |   "Red Devils FC" → "DEVILS FC"
 * Single-word names are returned as-is.
 */
function getTeamNickname(teamName: string): string {
  const words = teamName.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.slice(1).join(' ') : teamName).toUpperCase();
}

export function LiveSoldOverlay({ lastSold, config }: LiveSoldOverlayProps) {
  const catStyle  = getCategoryStyle(config, lastSold.player.category);
  const nickname  = getTeamNickname(lastSold.teamName);

  const particles = useMemo(() =>
    PARTICLES.map((p, i) => (
      <span
        key={i}
        className={styles.particle}
        style={{
          '--tx': p.tx, '--ty': p.ty, '--delay': p.delay,
          background: p.color,
        } as React.CSSProperties}
      />
    )), [],
  );

  return (
    <div
      className={styles.overlay}
      style={{ '--team-glow': lastSold.teamColor } as React.CSSProperties}
    >
      {/* ── Background atmosphere ────────────────────────────────────────── */}
      <div className={styles.spotlight} aria-hidden="true" />
      <div className={styles.rays}     aria-hidden="true" />

      {/* ── Left column: team logo (drops in from above) ─────────────────── */}
      <div className={styles.colLeft}>
        {lastSold.teamLogoBase64 ? (
          <img
            src={lastSold.teamLogoBase64}
            alt={lastSold.teamName}
            className={styles.teamLogo}
          />
        ) : (
          <div
            className={styles.teamLogoFallback}
            style={{ color: lastSold.teamColor }}
          >
            {lastSold.teamName.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* ── Centre column: SOLD stamp + player info + price ──────────────── */}
      <div className={styles.colCenter}>

        <div className={styles.stampArea}>
          {particles}
          <div className={styles.soldText}>SOLD</div>
        </div>

        <div className={styles.playerRow}>
          <Avatar
            src={lastSold.player.photoBase64}
            name={lastSold.player.name}
            size={88}
            color={catStyle.color}
            style={{ border: `3px solid ${catStyle.color}` }}
          />
          <div className={styles.playerInfo}>
            <span className={styles.playerName}>{lastSold.player.name}</span>
            <span className={styles.playerCat} style={{ color: catStyle.color }}>
              {lastSold.player.category}
            </span>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.teamRow}>
          <Avatar
            src={lastSold.teamLogoBase64}
            name={lastSold.teamName}
            size={52}
            color={lastSold.teamColor}
            square
          />
          <span className={styles.teamName} style={{ color: lastSold.teamColor }}>
            {lastSold.teamName}
          </span>
        </div>

        <div className={styles.priceTag}>
          <span className={styles.priceLabel}>FINAL PRICE</span>
          <span className={styles.priceValue} style={{ color: lastSold.teamColor }}>
            {formatPts(lastSold.finalPrice)} PTS
          </span>
        </div>

      </div>

      {/* ── Right column: welcome message (slides in from right) ─────────── */}
      <div className={styles.colRight}>
        <div className={styles.welcomeWrap}>
          <div
            className={styles.welcomeAccentBar}
            style={{ background: lastSold.teamColor }}
          />
          <span className={styles.welcomeLabel}>WELCOME TO</span>
          <span
            className={styles.welcomeName}
            style={{ color: lastSold.teamColor }}
          >
            {nickname}
          </span>
          <span className={styles.welcomeTagline}>THEIR NEWEST SIGNING</span>
        </div>
      </div>
    </div>
  );
}
