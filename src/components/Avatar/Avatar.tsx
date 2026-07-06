import { getInitials } from '@/utils/image';
import { withAlpha } from '@/utils/color';
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
        className={`${square ? styles.logoSquare : styles.avatar} ${className}`.trim()}
        style={{ ...dim, ...style }}
      />
    );
  }

  const initials = getInitials(name);
  const fontSize  = size < 32 ? size * 0.38 : size * 0.34;
  const bg = withAlpha(color, 0.18);
  const border = `1px solid ${withAlpha(color, 0.35)}`;

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
