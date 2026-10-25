import { Link } from 'react-router-dom';
import { cx } from '../../lib/cx';

export function LogoMark({ size = 28, className, dark }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill={dark ? '#FFFFFF' : '#0B1F1C'} />
      <circle cx="15" cy="15" r="7.5" fill="none" stroke="#0E9F8E" strokeWidth="3" />
      <path d="M19.5 19.5l5 5" stroke="#0E9F8E" strokeWidth="3" strokeLinecap="round" />
      <circle cx="15" cy="15" r="2" fill={dark ? '#0B1F1C' : '#FFFFFF'} />
    </svg>
  );
}

export default function Logo({ to = '/', light, className, size = 28 }) {
  return (
    <Link to={to} className={cx('inline-flex items-center gap-2 font-medium tracking-tight', light ? 'text-white' : 'text-ink', className)} aria-label="QueueLess home">
      <LogoMark size={size} dark={light} />
      <span className="text-[19px]">QueueLess</span>
    </Link>
  );
}
