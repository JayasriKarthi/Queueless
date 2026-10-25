import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { buildJoinSchema } from '../../lib/validators';
import DynamicField from './DynamicField';
import Button from '../ui/Button';

export default function JoinForm({ fields, allowPriority, onSubmit, disabled }) {
  const schema = useMemo(() => buildJoinSchema(fields), [fields]);
  const { register, handleSubmit, formState: { errors, isSubmitting, isSubmitSuccessful } } = useForm({ resolver: zodResolver(schema), defaultValues: { priority: false } });
  // Stays disabled after a successful submit so a double tap cannot create two tokens.
  const busy = isSubmitting || isSubmitSuccessful;
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {fields.map((f) => <DynamicField key={f.key} field={f} register={register} error={errors[f.key]?.message} />)}
      {allowPriority && (
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl bg-black/[.03] p-3 text-sm dark:bg-white/5">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--brand)]" {...register('priority')} />
          <span>
            <span className="font-medium">I need priority</span>
            <span className="block text-black/55 dark:text-white/55">Senior citizen, pregnant, or a medical or accessibility need. Staff may ask to confirm.</span>
          </span>
        </label>
      )}
      <Button type="submit" variant="brand" size="xl" className="w-full" loading={busy} disabled={disabled}>
        {busy ? 'Getting your token' : 'Get my token'}
      </Button>
      <p className="text-center text-xs text-black/45 dark:text-white/45">Your number is only used for this visit's alerts.</p>
    </form>
  );
}
