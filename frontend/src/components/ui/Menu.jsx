import { useEffect, useRef, useState } from 'react';
import { cx } from '../../lib/cx';

// Small dropdown menu. `trigger` receives the button props to spread.
export default function Menu({ trigger, items, align = 'right', className, header }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className={cx('relative', className)}>
      {trigger({ 'aria-haspopup': 'menu', 'aria-expanded': open, onClick: (e) => { e.stopPropagation(); setOpen((o) => !o); } })}
      {open && (
        <div role="menu" className={cx('absolute z-40 mt-1 min-w-[200px] rounded-xl border border-admin-border bg-white p-1.5 text-[13px] shadow-pop animate-pop dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100', align === 'right' ? 'right-0' : 'left-0')}>
          {header}
          {items.filter(Boolean).map((item, i) =>
            item.divider ? (
              <div key={`d${i}`} className="my-1 h-px bg-admin-border dark:bg-neutral-700" role="separator" />
            ) : (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick?.();
                }}
                className={cx('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[#F1F1F1] disabled:opacity-40 dark:hover:bg-neutral-800', item.tone === 'critical' && 'text-[#8E0B21] dark:text-red-300')}
              >
                {item.icon && <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                <span className="flex-1">{item.label}</span>
                {item.hint && <span className="text-xs text-admin-muted">{item.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
