import { Check, Shuffle } from 'lucide-react';
import { cx } from '../../lib/cx';

// Cards for picking a service or a resource, with a wait tag on each.
export default function ResourcePicker({ label, options, value, onChange }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="grid gap-2" role="radiogroup">
        {options.map((o) => {
          const sel = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={sel}
              disabled={o.disabled}
              onClick={() => onChange(o.id)}
              className={cx(
                'flex min-h-[56px] items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left transition disabled:opacity-50 dark:bg-neutral-900',
                sel ? 'border-[var(--brand)] bg-[var(--brand-soft)]' : 'border-transparent ring-1 ring-black/10 hover:ring-black/25 dark:ring-white/10',
              )}
            >
              <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2', sel ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-contrast)]' : 'border-black/20 dark:border-white/30')}>
                {sel && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              </span>
              {o.any && <Shuffle className="h-4 w-4 text-[var(--brand)]" aria-hidden="true" />}
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{o.title}</span>
                {o.subtitle && <span className="block text-sm text-black/55 dark:text-white/55">{o.subtitle}</span>}
              </span>
              {o.tag && <span className="shrink-0 rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium dark:bg-white/10">{o.tag}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
