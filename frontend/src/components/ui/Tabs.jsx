import { cx } from '../../lib/cx';

export default function Tabs({ tabs, value, onChange, className }) {
  const onKey = (e, idx) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    document.getElementById(`tab-${tabs[next].id}`)?.focus();
  };
  return (
    <div role="tablist" className={cx('flex gap-1 relative overflow-x-auto no-scrollbar border-b border-admin-border dark:border-neutral-800', className)}>
      {tabs.map((t, idx) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(e) => onKey(e, idx)}
            onClick={() => onChange(t.id)}
            className={cx(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
              selected ? 'border-[#303030] text-[#1A1A1A] dark:border-white dark:text-white' : 'border-transparent text-admin-muted hover:text-[#1A1A1A] hover:border-admin-border dark:hover:text-white',
            )}
          >
            {t.label}
            {t.badge != null && <span className="ml-1.5 rounded-full bg-[#E3E3E3] px-1.5 text-[11px] dark:bg-neutral-700">{t.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
