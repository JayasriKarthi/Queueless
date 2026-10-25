import { cx } from '../../lib/cx';

// The business's uploaded logo, or its first letter on its brand colour.
export default function BusinessLogo({ business, size = 40, className, rounded = 'rounded-xl' }) {
  const { logoDataUrl, brandColor } = business?.branding ?? {};
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center overflow-hidden font-medium text-white', rounded, className)} style={{ width: size, height: size, background: logoDataUrl ? 'transparent' : brandColor ?? '#0E9F8E', fontSize: size * 0.45 }}>
      {logoDataUrl ? <img src={logoDataUrl} alt={`${business.name} logo`} className="h-full w-full object-cover" /> : (business?.name?.[0] ?? 'Q').toUpperCase()}
    </span>
  );
}
