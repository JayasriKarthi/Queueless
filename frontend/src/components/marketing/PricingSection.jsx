import { useState } from 'react';
import { PLANS } from '../../config/plans';
import PlanCard from './PlanCard';
import PricingTable from './PricingTable';
import BillingToggle from './BillingToggle';
import Reveal from './Reveal';

export default function PricingSection() {
  const [cycle, setCycle] = useState('monthly');
  return (
    <section id="pricing" className="bg-cream">
      <div className="mk-container mk-section">
        <Reveal className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <p className="mk-eyebrow">Pricing</p>
            <h2 className="mt-4 text-display-sm font-normal">Pick a plan that fits your queue</h2>
            <p className="mt-4 text-lg text-black/65">Every plan includes full customisation. Upgrade only when you need more capacity or extras.</p>
          </div>
          <BillingToggle value={cycle} onChange={setCycle} />
        </Reveal>
        <div className="mt-12 grid gap-4 pt-3 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              cycle={cycle}
              highlighted={plan.popular}
              badge={plan.popular ? 'Most popular' : null}
              cta={plan.id === 'enterprise' ? 'Contact sales' : plan.trialDays ? 'Start free trial' : 'Start free'}
              to={plan.id === 'enterprise' ? '/contact-sales' : `/signup?plan=${plan.id}`}
            />
          ))}
        </div>
        <p className="mt-4 text-sm text-black/50">Prices in INR, excluding taxes. Placeholder pricing for this demo.</p>
        <PricingTable />
      </div>
    </section>
  );
}
