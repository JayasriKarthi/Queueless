import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Download } from 'lucide-react';
import { useTenant, useUsage, useTenantCollection } from '../../hooks/useTenant';
import { useBusinessStore } from '../../store/businessStore';
import { PLANS, getPlan, planPrice } from '../../config/plans';
import { changePlan } from '../../lib/fakeBackend';
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
  const usage = useUsage(business);
  const invoices = useTenantCollection(useBusinessStore, 'invoices');
  const [params, setParams] = useSearchParams();
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

  const select = (p) => {
    if (p.id === 'enterprise') return;
    if (ORDER.indexOf(p.id) < ORDER.indexOf(business.plan)) setDowngrade(p);
    else setCheckout(p);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Billing" subtitle="Plans only change limits and extras. Customisation is always free." />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card title="Current plan">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-2xl font-medium tracking-tight">{plan.name}</p>
            {business.plan === 'free' ? <Badge>Free forever</Badge> : <Badge tone="success" dot>Active</Badge>}
          </div>
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
          {business.plan === 'free' ? (
            <EmptyState compact icon={CreditCard} title="No card on file" description="You will add one when you upgrade." />
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-14 items-center justify-center rounded-md bg-gradient-to-br from-[#303030] to-[#1A1A1A] text-[10px] font-medium text-white">CARD</span>
              <div>
                <p className="font-medium">Card ending 4242</p>
                <p className="ql-subdued">Expires 12/29 · test mode</p>
              </div>
            </div>
          )}
          {business.plan !== 'free' && <Button size="sm" className="mt-4" onClick={() => toast('Updating cards is a placeholder in this demo')}>Update card</Button>}
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
            { key: 'status', header: 'Status', render: (i) => <Badge tone={i.status === 'Paid' ? 'success' : i.status === 'Trial' ? 'info' : 'neutral'}>{i.status}</Badge> },
            { key: 'dl', header: <span className="sr-only">Download</span>, render: () => <Button size="sm" variant="ghost" icon={Download} onClick={() => toast('Invoice PDFs are a placeholder in this demo')} aria-label="Download invoice" /> },
          ]}
          empty={<EmptyState compact title="No invoices yet" description="Invoices appear here after your first paid plan." />}
        />
      </Card>

      <CheckoutModal
        open={Boolean(checkout)}
        plan={checkout}
        cycle={cycle}
        onClose={closeCheckout}
        onSuccess={(p, c) => {
          changePlan(business.id, p.id, c);
          toast(`${p.name} plan activated`);
          closeCheckout();
        }}
      />
      <ConfirmDialog
        open={Boolean(downgrade)}
        onClose={() => setDowngrade(null)}
        tone="primary"
        title={`Downgrade to ${downgrade?.name}?`}
        message="Your services, counters, staff, and history are all kept. Extras on your current plan will lock, and you will not be able to add more than the new plan allows."
        confirmLabel="Downgrade"
        onConfirm={() => {
          changePlan(business.id, downgrade.id, cycle);
          toast(`Moved to the ${downgrade.name} plan`);
          setDowngrade(null);
        }}
      />
    </div>
  );
}
