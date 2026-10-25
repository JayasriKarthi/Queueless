import { cx } from '../../lib/cx';

function Illustration() {
  return (
    <svg viewBox="0 0 120 80" className="h-20 w-28" aria-hidden="true">
      <rect x="10" y="18" width="100" height="52" rx="10" fill="#F1F1F1" stroke="#D4D4D4" />
      <circle cx="32" cy="44" r="9" fill="#C7EBE6" />
      <circle cx="58" cy="44" r="9" fill="#E3E3E3" />
      <circle cx="84" cy="44" r="9" fill="#E3E3E3" />
      <path d="M26 44h12M52 44h12M78 44h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <rect x="40" y="6" width="40" height="14" rx="7" fill="#0E9F8E" />
      <text x="60" y="16" textAnchor="middle" fontSize="8" fill="#fff" fontFamily="system-ui">A-001</text>
    </svg>
  );
}

export default function EmptyState({ title, description, action, icon: Icon, className, compact }) {
  return (
    <div className={cx('flex flex-col items-center rounded-xl border border-dashed border-[#C9C9C9] text-center dark:border-neutral-700', compact ? 'p-6' : 'px-6 py-12', className)}>
      {Icon ? <Icon className="h-10 w-10 text-admin-muted" aria-hidden="true" /> : <Illustration />}
      <h3 className="mt-3 text-sm font-medium">{title}</h3>
      {description && <p className="mt-1 max-w-sm ql-subdued">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
