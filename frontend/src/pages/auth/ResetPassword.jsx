import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthShell from './AuthShell';
import PasswordInput from '../../components/ui/PasswordInput';
import PasswordStrength from '../../components/ui/PasswordStrength';
import Button from '../../components/ui/Button';
import Banner from '../../components/ui/Banner';
import { resetPasswordSchema } from '../../lib/validators';
import { resetPassword } from '../../lib/fakeBackend';
import { toast } from '../../store/uiStore';

// Opened from the "Reset your password" email. The link works once and for one hour; the
// server checks it, sets the new password, and logs out every other session.
export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = async ({ password }) => {
    setError('');
    const res = await resetPassword(token, password);
    if (!res.ok) return setError(res.details?.[0]?.message ?? res.error);
    toast('Password changed. Log in with your new password.');
    navigate('/login', { replace: true });
  };

  return (
    <AuthShell panelTitle="Back in a minute.">
      <h1 className="text-[28px] font-medium tracking-tight">Set a new password</h1>
      <p className="mt-1 text-sm text-admin-muted">Choose a password you have not used here before. Other devices will be logged out.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        {error && (
          <Banner tone="critical">
            {error} <Link to="/login" className="underline">Ask for a new link</Link> from the login page.
          </Banner>
        )}
        <div>
          <PasswordInput label="New password" autoComplete="new-password" inputClassName="h-11" help="At least 8 characters" error={errors.password?.message} {...register('password')} />
          <PasswordStrength value={watch('password')} />
        </div>
        <PasswordInput label="Confirm new password" autoComplete="new-password" inputClassName="h-11" error={errors.confirm?.message} {...register('confirm')} />
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
          Save new password
        </Button>
      </form>
    </AuthShell>
  );
}
