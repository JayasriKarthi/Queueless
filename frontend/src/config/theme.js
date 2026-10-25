export const BRAND = { teal: '#0E9F8E', tealHover: '#0B8577', ink: '#0B1F1C', cream: '#F6F6F1' };

export const BRAND_SWATCHES = ['#0E9F8E', '#2563EB', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#CA8A04', '#0B1F1C'];

export function hexToRgb(hex) {
  const clean = String(hex || BRAND.teal).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(',')},${a})`;

// Picks white or near-black text so brand-coloured buttons stay readable.
export function contrastText(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? '#0B1F1C' : '#FFFFFF';
}

export function brandVars(color = BRAND.teal) {
  return {
    '--brand': color,
    '--brand-soft': rgba(color, 0.12),
    '--brand-ring': rgba(color, 0.35),
    '--brand-contrast': contrastText(color),
  };
}
