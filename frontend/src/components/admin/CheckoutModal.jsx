import { useState } from 'react';
import { CreditCard, FlaskConical, ExternalLink } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Banner from '../ui/Banner';
import { planPrice } from '../../config/plans';
import { formatINR } from '../../lib/formatters';
import { startCheckout } from '../../lib/fakeBackend';

// Paid plans go through Stripe's own checkout page, in test mode only (no real money): the card
// is typed on Stripe's page, never here. Stripe sends the owner back to /admin/billing, and the
// plan switches on when Stripe's webhook reaches the server (the page updates by itself).
export default function CheckoutModal({ open, onClose, plan, cycle }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (!plan) return null;
  const price = planPrice(plan, cycle);
  const total = cycle === 'yearly' ? price * 12 : price;

  const go = async () => {
    setBusy(true);
    setError(null);
    const res = await startCheckout(plan.id, cycle);
    if (!res.ok) {
      setBusy(false);
      return setError(res.code === 'PAYMENTS_NOT_CONFIGURED' ? 'Payments are not set up on this server yet. Add a Stripe test key (sk_test_...) as STRIPE_SECRET_KEY in backend/.env and restart the backend.' : res.error);
    }
    window.location.assign(res.url); // Stripe's checkout page
  };

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : () => { setError(null); onClose(); }}
      title={`Upgrade to ${plan.name}`}
      size="md"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" icon={ExternalLink} loading={busy} onClick={go}>Continue to secure checkout</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg bg-[#FFF5D6] px-3 py-2 text-[13px] text-[#5C4400]">
          <FlaskConical className="h-4 w-4" aria-hidden="true" /> Stripe test mode, no real payment. On Stripe's page use card 4242 4242 4242 4242, any future date, any CVC.
        </div>
        <div className="rounded-xl border border-admin-border p-3 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <p className="font-medium">{plan.name} plan</p>
            <CreditCard className="h-4 w-4 text-admin-muted" aria-hidden="true" />
          </div>
          <div className="mt-2 flex justify-between text-[13px]">
            <span>{formatINR(price)} × {cycle === 'yearly' ? '12 months' : '1 month'}</span>
            <span>{formatINR(total)}</span>
          </div>
          {plan.trialDays > 0 && <p className="mt-1 text-[13px] text-[#0C5132] dark:text-emerald-300">Due today: ₹0 ({plan.trialDays}-day free trial, first time only)</p>}
        </div>
        <p className="ql-subdued">You will type the card on Stripe's page. When you come back, your plan switches on as soon as Stripe confirms the payment.</p>
        {error && <Banner tone="critical">{error}</Banner>}
      </div>
    </Modal>
  );
}
