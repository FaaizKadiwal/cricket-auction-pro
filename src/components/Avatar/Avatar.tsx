import { getInitials } from '@/utils/image';
import styles from './Avatar.module.css';

interface AvatarProps {
  src: string | null;
  name: string;
  size?: number;
  color?: string;  // used for fallback background tint
  square?: boolean; // for team logos
  className?: string;
  style?: React.CSSProperties;
}

export function Avatar({
  src, name, size = 36, color = '#00d4ff', square = false, className = '', style,
}: AvatarProps) {
  const dim = { width: size, height: size };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={square ? styles.logoSquare : styles.avatar}
        style={{ ...dim, ...style }}
      />
    );
  }

  const initials = getInitials(name);
  const fontSize  = size < 32 ? size * 0.38 : size * 0.34;
  const bg = hexToRgba(color, 0.18);
  const border = `1px solid ${hexToRgba(color, 0.35)}`;

  return (
    <div
      className={`${square ? styles.logoFallback : styles.avatarFallback} ${className}`}
      style={{ ...dim, background: bg, border, color, fontSize, ...style }}
      aria-label={name}
      role="img"
    >
      {initials}
    </div>
  );
}

// ─── Tiny helper ─────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(0,212,255,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}
