import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { contactSalesSchema } from '../../lib/validators';
import Button from '../../components/ui/Button';

function MkField({ label, error, id, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {error && <p className="mt-1 text-sm text-[#8E0B21]" role="alert">{error}</p>}
    </div>
  );
}

const inputCls = 'h-12 w-full rounded-xl border border-black/20 px-4 text-base outline-none focus:border-ink focus:ring-2 focus:ring-teal';

export default function ContactSales() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(contactSalesSchema) });
  const onSubmit = () => new Promise((r) => setTimeout(r, 700)).then(() => setSent(true));

  return (
    <section className="bg-cream">
      <div className="mk-container grid gap-12 py-20 md:grid-cols-2 md:py-28">
        <div>
          <p className="mk-eyebrow">Enterprise</p>
          <h1 className="mt-4 text-display-sm font-normal">Talk to our team</h1>
          <p className="mt-6 max-w-md text-lg text-black/65">Tell us about your locations and how people wait today. We will set up a tailored walkthrough.</p>
        </div>
        <div className="rounded-xl2 bg-white p-6 sm:p-10">
          {sent ? (
            <div className="py-10 text-center" role="status">
              <CheckCircle2 className="mx-auto h-12 w-12 text-teal" aria-hidden="true" />
              <p className="mt-4 text-2xl">Thanks, message received</p>
              <p className="mt-2 text-black/60">We will get back to you within one business day.</p>
              <Button variant="pillOutline" size="lg" to="/" className="mt-8">Back to home</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
              <MkField id="cs-name" label="Full name" error={errors.name?.message}>
                <input id="cs-name" className={inputCls} autoComplete="name" {...register('name')} />
              </MkField>
              <MkField id="cs-email" label="Work email" error={errors.email?.message}>
                <input id="cs-email" type="email" className={inputCls} autoComplete="email" {...register('email')} />
              </MkField>
              <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
                <MkField id="cs-company" label="Company" error={errors.company?.message}>
                  <input id="cs-company" className={inputCls} autoComplete="organization" {...register('company')} />
                </MkField>
                <MkField id="cs-loc" label="Locations" error={errors.locations?.message}>
                  <input id="cs-loc" type="number" min="1" inputMode="numeric" className={inputCls} {...register('locations')} />
                </MkField>
              </div>
              <MkField id="cs-msg" label="Message (optional)" error={errors.message?.message}>
                <textarea id="cs-msg" rows={4} className={`${inputCls} h-auto py-3`} {...register('message')} />
              </MkField>
              <Button type="submit" variant="pill" size="xl" loading={isSubmitting} className="w-full">
                Contact sales
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
