import { Check } from 'lucide-react';
import { planPrice } from '../../config/plans';
import { formatINR } from '../../lib/formatters';
import { cx } from '../../lib/cx';
import Button from '../ui/Button';

// Used on the pricing section, onboarding, and billing.
export default function PlanCard({ plan, cycle, badge, highlighted, cta, onSelect, to, current, compact }) {
  const price = planPrice(plan, cycle);
  return (
    <div className={cx('relative flex flex-col rounded-xl2 border p-6', highlighted ? 'border-ink bg-ink text-white' : 'border-black/10 bg-white', compact && 'p-5')}>
      {badge && <span className={cx('absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-medium', highlighted ? 'bg-teal text-white' : 'bg-ink text-white')}>{badge}</span>}
      <p className="text-xl font-medium">{plan.name}</p>
      <p className={cx('mt-1 text-sm', highlighted ? 'text-white/65' : 'text-black/55')}>{plan.tagline}</p>
      <p className="mt-6 flex items-baseline gap-1">
        <span className="text-4xl font-normal tracking-tight">{price == null ? 'Custom' : formatINR(price)}</span>
        {price != null && <span className={cx('text-sm', highlighted ? 'text-white/65' : 'text-black/55')}>/month{cycle === 'yearly' && price ? ', billed yearly' : ''}</span>}
      </p>
      {plan.trialDays > 0 && <p className={cx('mt-1 text-xs', highlighted ? 'text-[#5FD3C4]' : 'text-teal-700')}>{plan.trialDays}-day free trial</p>}
      <div className="mt-6">
        {current ? (
          <Button variant={highlighted ? 'pillLight' : 'pillOutline'} size="lg" className="w-full" disabled>
            Current plan
          </Button>
        ) : (
          <Button variant={highlighted ? 'pillLight' : 'pill'} size="lg" className="w-full" to={to} onClick={onSelect}>
            {cta}
          </Button>
        )}
      </div>
      {!compact && (
        <ul className="mt-6 space-y-2.5 text-[15px]">
          {plan.highlights.map((h) => (
            <li key={h} className="flex gap-2">
              <Check className={cx('mt-0.5 h-4 w-4 shrink-0', highlighted ? 'text-[#5FD3C4]' : 'text-teal')} aria-hidden="true" />
              {h}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
