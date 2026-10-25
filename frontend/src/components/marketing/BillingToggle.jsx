import { cx } from '../../lib/cx';

export default function BillingToggle({ value, onChange, dark }) {
  return (
    <div role="radiogroup" aria-label="Billing cycle" className={cx('inline-flex rounded-full p-1', dark ? 'bg-white/10' : 'bg-black/5')}>
      {[
        ['monthly', 'Monthly'],
        ['yearly', 'Yearly'],
      ].map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={cx('h-10 rounded-full px-5 text-sm font-medium transition', value === id ? 'bg-white text-ink shadow-card' : dark ? 'text-white/70' : 'text-black/60')}
        >
          {label}
          {id === 'yearly' && <span className="ml-1.5 rounded-full bg-teal px-1.5 py-0.5 text-[11px] text-white">Save 20%</span>}
        </button>
      ))}
    </div>
  );
}
