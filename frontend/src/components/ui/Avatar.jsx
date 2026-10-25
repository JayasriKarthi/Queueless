import { initials } from '../../lib/formatters';
import { cx } from '../../lib/cx';

export default function Avatar({ name, color = '#0E9F8E', src, size = 32, className }) {
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium text-white', className)}
      style={{ width: size, height: size, background: src ? 'transparent' : color, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}
