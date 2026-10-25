import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, CreditCard, FlaskConical } from 'lucide-react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { checkoutSchema } from '../../lib/validators';
import { planPrice } from '../../config/plans';
import { formatINR } from '../../lib/formatters';

const formatCard = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
const formatExpiry = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

// Test-mode checkout. Validates card format only; no payment request is made.
export default function CheckoutModal({ open, onClose, plan, cycle, onSuccess, successLabel = 'Continue' }) {
  const [done, setDone] = useState(false);
  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { cardName: '', cardNumber: '', expiry: '', cvc: '' },
  });
  useEffect(() => {
    if (open) {
      setDone(false);
      reset();
    }
  }, [open, reset]);
  if (!plan) return null;
  const price = planPrice(plan, cycle);
  const total = cycle === 'yearly' ? price * 12 : price;

  const submit = async () => {
    await new Promise((r) => setTimeout(r, 1200));
    setDone(true);
  };

  return (
    <Modal open={open} onClose={isSubmitting ? undefined : onClose} title={done ? 'Payment complete' : `Upgrade to ${plan.name}`} size="md">
      {done ? (
        <div className="py-6 text-center" role="status">
          <CheckCircle2 className="mx-auto h-12 w-12 text-[#29845A]" aria-hidden="true" />
          <p className="mt-3 text-lg font-medium">You are on the {plan.name} plan</p>
          <p className="ql-subdued mt-1">
            {plan.trialDays ? `Your ${plan.trialDays}-day trial has started. ` : ''}New features are unlocked right away.
          </p>
          <Button variant="primary" className="mt-5" onClick={() => onSuccess(plan, cycle)}>
            {successLabel}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-[#FFF5D6] px-3 py-2 text-[13px] text-[#5C4400]">
            <FlaskConical className="h-4 w-4" aria-hidden="true" /> Test mode, no real payment. Try 4242 4242 4242 4242.
          </div>
          <div className="rounded-xl border border-admin-border p-3 dark:border-neutral-700">
            <div className="flex items-center justify-between">
              <span className="font-medium">{plan.name} plan</span>
              <Badge tone="info">{cycle === 'yearly' ? 'Yearly' : 'Monthly'}</Badge>
            </div>
            <div className="mt-2 flex justify-between text-[13px] text-admin-muted">
              <span>{formatINR(price)} × {cycle === 'yearly' ? '12 months' : '1 month'}</span>
              <span>{formatINR(total)}</span>
            </div>
            {plan.trialDays > 0 && <p className="mt-1 text-[13px] text-[#0C5132] dark:text-emerald-300">Due today: ₹0 ({plan.trialDays}-day free trial)</p>}
          </div>
          <Input label="Name on card" autoComplete="cc-name" error={errors.cardName?.message} {...register('cardName')} />
          <Input
            label="Card number"
            inputMode="numeric"
            autoComplete="cc-number"
            prefix={<CreditCard className="h-4 w-4" />}
            error={errors.cardNumber?.message}
            {...register('cardNumber', { onChange: (e) => setValue('cardNumber', formatCard(e.target.value)) })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Expiry" placeholder="MM/YY" inputMode="numeric" autoComplete="cc-exp" error={errors.expiry?.message} {...register('expiry', { onChange: (e) => setValue('expiry', formatExpiry(e.target.value)) })} />
            <Input label="CVC" inputMode="numeric" maxLength={4} autoComplete="cc-csc" error={errors.cvc?.message} {...register('cvc')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {isSubmitting ? 'Processing' : plan.trialDays ? 'Start free trial' : `Pay ${formatINR(total)}`}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
