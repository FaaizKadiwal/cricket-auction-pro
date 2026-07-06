/**
 * Small colour helpers. Team/category colours come from `<input type="color">`
 * and the DEFAULT_* constants (always #rrggbb), but these tolerate #rgb shorthand
 * and non-hex input (e.g. a `var(--token)`) by falling back gracefully.
 */

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

/** `rgba(...)` string from a hex colour at the given alpha (0–1). Falls back to accent cyan for non-hex input. */
export function withAlpha(hex: string, alpha: number): string {
  const c = parseHex(hex);
  if (!c) return `rgba(0, 212, 255, ${alpha})`;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

/** Darken a hex colour by multiplying each channel by `factor` (0–1). Used for category badge backgrounds. */
export function darken(hex: string, factor: number): string {
  const c = parseHex(hex);
  if (!c) return hex;
  const ch = (v: number) => Math.round(v * factor).toString(16).padStart(2, '0');
  return `#${ch(c.r)}${ch(c.g)}${ch(c.b)}`;
}
