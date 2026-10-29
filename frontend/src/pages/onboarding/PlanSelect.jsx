import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PLANS } from '../../config/plans';
import { changePlan } from '../../lib/fakeBackend';
import { useTenant } from '../../hooks/useTenant';
import { toast } from '../../store/uiStore';
import PlanCard from '../../components/marketing/PlanCard';
import BillingToggle from '../../components/marketing/BillingToggle';
import CheckoutModal from '../../components/admin/CheckoutModal';

const RECOMMEND = { 'Under 50': 'free', '50 to 200': 'pro', '200 to 500': 'business', '500 to 2,000': 'business', 'More than 2,000': 'business' };

export default function PlanSelect() {
  const { business } = useTenant();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState('monthly');
  const [checkout, setCheckout] = useState(null);
  const recommended = business.intendedPlan ?? RECOMMEND[business.dailyCustomers] ?? 'pro';
  const plans = PLANS.filter((p) => p.id !== 'enterprise');

  // Skip and Free both keep the Free plan.
  const stayFree = async () => {
    const res = await changePlan(business.id, 'free');
    if (!res.ok) return toast(res.error, { tone: 'critical' });
    navigate('/admin');
  };

  return (
    <div>
      <p className="text-sm text-admin-muted">Step 2 of 2</p>
      <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-[clamp(28px,4vw,44px)] font-normal leading-tight tracking-[-0.03em]">Choose a plan</h1>
          <p className="mt-2 text-black/60">Everything is customisable on every plan. Paid plans add capacity and extras.</p>
        </div>
        <BillingToggle value={cycle} onChange={setCycle} />
      </div>
      <div className="mt-10 grid gap-4 pt-3 md:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            cycle={cycle}
            highlighted={plan.id === recommended}
            badge={plan.id === recommended ? 'Recommended for you' : null}
            cta={plan.id === 'free' ? 'Continue with Free' : `Choose ${plan.name}`}
            onSelect={() => (plan.id === 'free' ? stayFree() : setCheckout(plan))}
          />
        ))}
      </div>
      <div className="mt-10 text-center">
        <button type="button" onClick={stayFree} className="text-base font-medium text-ink underline underline-offset-4 hover:text-teal-700">
          Skip for now
        </button>
        <p className="mt-1 text-sm text-black/50">You will start on the Free plan and can upgrade any time.</p>
      </div>
      <CheckoutModal
        open={Boolean(checkout)}
        plan={checkout}
        cycle={cycle}
        onClose={() => setCheckout(null)}
      />
    </div>
  );
}
