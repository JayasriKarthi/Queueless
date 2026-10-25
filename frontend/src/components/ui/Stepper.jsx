import { Check } from 'lucide-react';
import { cx } from '../../lib/cx';

export default function Stepper({ steps, current }) {
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label={`Step ${current + 1} of ${steps.length}`}>
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={cx(
              'flex h-6 w-6 items-center justify-center rounded-full font-medium',
              i < current ? 'bg-teal text-white' : i === current ? 'bg-ink text-white' : 'bg-[#E3E3E3] text-admin-muted',
            )}
            aria-current={i === current ? 'step' : undefined}
          >
            {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={cx('hidden sm:inline', i === current ? 'font-medium' : 'text-admin-muted')}>{s}</span>
          {i < steps.length - 1 && <span className="h-px w-8 bg-[#D4D4D4]" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}
