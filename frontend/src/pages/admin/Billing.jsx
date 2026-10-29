import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Download } from 'lucide-react';
import { useTenant } from '../../hooks/useTenant';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { PLANS, getPlan, planPrice } from '../../config/plans';
import { changePlan, getBilling } from '../../lib/fakeBackend';
import Banner from '../../components/ui/Banner';
import { formatINR, formatDate } from '../../lib/formatters';
import { toast } from '../../store/uiStore';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Table from '../../components/ui/Table';
import UsageMeter from '../../components/ui/UsageMeter';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import PlanCard from '../../components/marketing/PlanCard';
import BillingToggle from '../../components/marketing/BillingToggle';
import CheckoutModal from '../../components/admin/CheckoutModal';

const ORDER = PLANS.map((p) => p.id);

export default function Billing() {
  const { business } = useTenant();
  // From the server, reloaded live: when Stripe's webhook switches the plan on, this updates.
  const { data } = useLiveQuery(getBilling, [], { events: ['business:updated', 'notification:new', 'token:created'] });
  const meter = (m) => ({ used: m?.used ?? 0, limit: m?.limit ?? Infinity }); // null limit = unlimited
  const usage = { tokensPerDay: meter(data?.usage.tokensToday), counters: meter(data?.usage.counters), staffSeats: meter(data?.usage.staffSeats), smsPerMonth: meter(data?.usage.smsThisMonth) };
  const invoices = data?.invoices ?? [];
  const subscription = data?.subscription;
  const [params, setParams] = useSearchParams();
  const returned = params.get('checkout'); // Stripe sends the owner back with ?checkout=success or cancelled
  const [cycle, setCycle] = useState(business.billingCycle ?? 'monthly');
  const [checkout, setCheckout] = useState(null);
  const [downgrade, setDowngrade] = useState(null);
  const plan = getPlan(business.plan);
  const price = planPrice(plan, business.billingCycle);

  // /admin/billing?upgrade=pro opens checkout for that plan straight away.
  useEffect(() => {
    const id = params.get('upgrade');
    const target = PLANS.find((p) => p.id === id);
    if (target && target.id !== business.plan && target.id !== 'enterprise' && ORDER.indexOf(target.id) > ORDER.indexOf(business.plan)) setCheckout(target);
  }, [params, business.plan]);

  const closeCheckout = () => {
    setCheckout(null);
    if (params.get('upgrade')) setParams({}, { replace: true });
  };

  // Down to Free is a confirm; any other change (up, or Business to Pro) goes through checkout.
  const select = (p) => {
    if (p.id === 'enterprise') return;
    if (p.id === 'free') setDowngrade(p);
    else setCheckout(p);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Billing" subtitle="Plans only change limits and extras. Customisation is always free." />
      {returned === 'success' && business.plan === 'free' && (
        <Banner tone="info" title="Payment received">Your plan switches on as soon as Stripe confirms it. This page updates by itself.</Banner>
      )}
      {returned === 'success' && business.plan !== 'free' && <Banner tone="success" title={`You are on the ${getPlan(business.plan).name} plan`}>New features are unlocked.</Banner>}
      {returned === 'cancelled' && <Banner tone="warning" title="Checkout cancelled">Nothing was charged. You can upgrade any time.</Banner>}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card title="Current plan">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-2xl font-medium tracking-tight">{plan.name}</p>
            {business.plan === 'free' ? <Badge>Free forever</Badge> : subscription?.status === 'trialing' ? <Badge tone="info" dot>Free trial</Badge> : subscription?.status === 'past_due' ? <Badge tone="critical" dot>Payment due</Badge> : <Badge tone="success" dot>Active</Badge>}
          </div>
          {subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd && <p className="mt-1 text-[13px] text-[#8E0B21] dark:text-red-300">Ends on {formatDate(subscription.currentPeriodEnd)}, then moves to Free. Nothing is deleted.</p>}
          {subscription?.status === 'trialing' && subscription.trialEndsAt && <p className="mt-1 text-[13px]">Trial ends on {formatDate(subscription.trialEndsAt)}.</p>}
          <p className="ql-subdued mt-1">
            {price == null ? 'Custom pricing' : price === 0 ? 'No charge' : `${formatINR(price)} a month, billed ${business.billingCycle === 'yearly' ? 'yearly' : 'monthly'}`}
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <UsageMeter label="Tokens today" used={usage.tokensPerDay.used} limit={usage.tokensPerDay.limit} />
            <UsageMeter label={business.labels.resourcePlural} used={usage.counters.used} limit={usage.counters.limit} />
            <UsageMeter label="Staff seats" used={usage.staffSeats.used} limit={usage.staffSeats.limit} />
            <UsageMeter label="SMS credits this month" used={usage.smsPerMonth.used} limit={usage.smsPerMonth.limit} />
          </div>
          <p className="ql-subdued mt-4">Over a limit? Nothing is deleted. You just cannot add more until you upgrade.</p>
        </Card>
        <Card title="Payment method">
          {!data?.paymentMethod ? (
            <EmptyState compact icon={CreditCard} title="No card on file" description="You will add one on Stripe's page when you upgrade." />
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-14 items-center justify-center rounded-md bg-gradient-to-br from-[#635BFF] to-[#4B44C8] text-[10px] font-medium text-white">STRIPE</span>
              <div>
                <p className="font-medium">Card kept by Stripe</p>
                <p className="ql-subdued">Test mode · card details never reach QueueLess</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card title="Change plan" actions={<BillingToggle value={cycle} onChange={setCycle} />}>
        <div className="grid gap-4 pt-3 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p) => {
            const isCurrent = p.id === business.plan;
            const lower = ORDER.indexOf(p.id) < ORDER.indexOf(business.plan);
            return (
              <PlanCard
                key={p.id}
                compact
                plan={p}
                cycle={cycle}
                current={isCurrent}
                highlighted={p.popular && !isCurrent}
                badge={isCurrent ? 'Your plan' : p.popular ? 'Most popular' : null}
                cta={p.id === 'enterprise' ? 'Contact sales' : lower ? `Downgrade to ${p.name}` : `Upgrade to ${p.name}`}
                to={p.id === 'enterprise' ? '/contact-sales' : undefined}
                onSelect={() => select(p)}
              />
            );
          })}
        </div>
        <Button variant="plain" className="mt-3" to="/pricing">Compare every feature</Button>
      </Card>

      <Card title="Invoices" padded={false}>
        <Table
          caption="Invoices"
          rows={invoices}
          columns={[
            { key: 'number', header: 'Invoice', render: (i) => <span className="font-medium">{i.number}</span> },
            { key: 'date', header: 'Date', render: (i) => formatDate(i.date) },
            { key: 'plan', header: 'Plan', className: 'hidden sm:table-cell' },
            { key: 'amount', header: 'Amount', render: (i) => formatINR(i.amount) },
            { key: 'status', header: 'Status', render: (i) => <Badge tone={i.status === 'paid' ? 'success' : i.status === 'trial' ? 'info' : i.status === 'failed' ? 'critical' : 'neutral'}>{i.status[0].toUpperCase() + i.status.slice(1)}</Badge> },
            { key: 'dl', header: <span className="sr-only">Download</span>, render: (i) => (i.pdfUrl ? <Button size="sm" variant="ghost" icon={Download} href={i.pdfUrl} target="_blank" rel="noopener" aria-label={`Download invoice ${i.number}`} /> : null) },
          ]}
          empty={<EmptyState compact title="No invoices yet" description="Invoices appear here after your first paid plan." />}
        />
      </Card>

      <CheckoutModal
        open={Boolean(checkout)}
        plan={checkout}
        cycle={cycle}
        onClose={closeCheckout}
      />
      <ConfirmDialog
        open={Boolean(downgrade)}
        onClose={() => setDowngrade(null)}
        tone="primary"
        title={`Downgrade to ${downgrade?.name}?`}
        message="Your services, counters, staff, and history are all kept. A paid plan runs to the end of the period already paid for, then moves to Free."
        confirmLabel="Downgrade"
        onConfirm={async () => {
          setDowngrade(null);
          const res = await changePlan(business.id, 'free');
          if (!res.ok) return toast(res.error, { tone: 'critical' });
          toast(res.effective === 'at_period_end' ? 'Your plan will move to Free at the end of this period' : 'Moved to the Free plan');
        }}
      />
    </div>
  );
}
