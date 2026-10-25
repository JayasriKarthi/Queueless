import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BUSINESS_TYPES, DAILY_CUSTOMER_RANGES } from '../../config/constants';
import { completeWelcome } from '../../lib/fakeBackend';
import { useTenant } from '../../hooks/useTenant';
import Button from '../../components/ui/Button';
import { cx } from '../../lib/cx';

export default function Welcome() {
  const { business, user } = useTenant();
  const navigate = useNavigate();
  const [type, setType] = useState(business.type);
  const [range, setRange] = useState(business.dailyCustomers);

  const next = (skip) => {
    if (!skip) completeWelcome(business.id, { type, dailyCustomers: range });
    navigate('/onboarding/plan');
  };

  return (
    <div>
      <p className="text-sm text-admin-muted">Step 1 of 2</p>
      <h1 className="mt-2 text-[clamp(28px,4vw,44px)] font-normal leading-tight tracking-[-0.03em]">Welcome, {user.name.split(' ')[0]}. Tell us about {business.name}.</h1>
      <p className="mt-2 text-black/60">We use this to set up services, labels, and the queue mode for you. You can change everything later.</p>

      <fieldset className="mt-10">
        <legend className="text-lg font-medium">What kind of business is it?</legend>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup">
          {BUSINESS_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={type === t.id}
              onClick={() => setType(t.id)}
              className={cx('flex min-h-[112px] flex-col items-start rounded-2xl border-2 bg-white p-4 text-left transition', type === t.id ? 'border-ink' : 'border-transparent hover:border-black/15')}
            >
              <t.icon className="h-6 w-6 text-teal" aria-hidden="true" />
              <span className="mt-3 font-medium">{t.label}</span>
              <span className="text-[13px] text-black/55">{t.blurb}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-10">
        <legend className="text-lg font-medium">About how many customers a day?</legend>
        <div className="mt-4 flex flex-wrap gap-2" role="radiogroup">
          {DAILY_CUSTOMER_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={range === r}
              onClick={() => setRange(r)}
              className={cx('h-11 rounded-full border px-5 text-sm font-medium transition', range === r ? 'border-ink bg-ink text-white' : 'border-black/15 bg-white hover:border-black/40')}
            >
              {r}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-12 flex flex-wrap items-center gap-4">
        <Button variant="pill" size="xl" onClick={() => next(false)}>Continue</Button>
        <button type="button" onClick={() => next(true)} className="text-sm font-medium text-black/60 underline-offset-4 hover:underline">
          Skip
        </button>
      </div>
    </div>
  );
}
