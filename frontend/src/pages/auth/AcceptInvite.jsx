import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LinkIcon } from 'lucide-react';
import Input from '../../components/ui/Input';
import PasswordInput from '../../components/ui/PasswordInput';
import PasswordStrength from '../../components/ui/PasswordStrength';
import Button from '../../components/ui/Button';
import Banner from '../../components/ui/Banner';
import BusinessLogo from '../../components/ui/BusinessLogo';
import StatusScreen from '../../components/ui/StatusScreen';
import Logo from '../../components/ui/Logo';
import { acceptInviteSchema } from '../../lib/validators';
import { acceptInvite, getInviteByToken } from '../../lib/fakeBackend';
import { toast } from '../../store/uiStore';
import Spinner from '../../components/ui/Spinner';

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState(null); // { valid, invite, business } from the server
  useEffect(() => {
    getInviteByToken(token).then(setState);
  }, [token]);
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(acceptInviteSchema) });

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-bg" role="status" aria-label="Loading">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  const { invite, business, valid } = state;
  if (!valid) {
    return (
      <div className="min-h-screen bg-admin-bg">
        <div className="px-4 py-6 sm:px-10"><Logo /></div>
        <StatusScreen icon={LinkIcon} title="This invite link is no longer valid" actions={<Button variant="primary" to="/login">Go to log in</Button>}>
          The invite may have expired, been used already, or been replaced by a newer one. Ask your business owner to resend it.
        </StatusScreen>
      </div>
    );
  }

  const resource = business.resources.find((r) => r.id === invite.resourceId);
  const roleLabel = invite.role === 'manager' ? 'a manager' : 'staff';

  const onSubmit = async (data) => {
    const res = await acceptInvite(token, data);
    if (!res.ok) {
      const fields = (res.details ?? []).filter((d) => ['name', 'password', 'confirm', 'pin'].includes(d.field));
      if (fields.length) fields.forEach((d) => setError(d.field, { message: d.message }));
      else setError('name', { message: res.error });
      return;
    }
    toast(res.generatedPin ? `Welcome to ${business.name}. Your PIN is ${res.generatedPin}; keep it safe.` : `Welcome to ${business.name}`, { duration: res.generatedPin ? 12000 : 4000 });
    navigate(res.home, { replace: true });
  };

  return (
    <div className="min-h-screen bg-admin-bg px-4 py-6 sm:px-10">
      <Logo />
      <div className="mx-auto mt-10 max-w-md">
        <div className="ql-card p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <BusinessLogo business={business} size={56} />
            <h1 className="mt-4 text-xl font-medium tracking-tight">You have been invited to join {business.name} as {roleLabel}</h1>
            <p className="ql-subdued mt-1">
              {invite.email}
              {resource && ` · ${business.labels.resource}: ${resource.name}`}
            </p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
            <Input label="Full name" autoComplete="name" error={errors.name?.message} {...register('name')} />
            <div>
              <PasswordInput label="Password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
              <PasswordStrength value={watch('password')} />
            </div>
            <PasswordInput label="Confirm password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
            <Input label="4-digit PIN" optional inputMode="numeric" maxLength={4} help="Used to switch users quickly on a shared front-desk computer." error={errors.pin?.message} {...register('pin')} />
            <Banner tone="info">You will log in at the same QueueLess login page as everyone else.</Banner>
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
              Create my account
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-admin-muted">
          Already have an account? <Link to="/login" className="text-[#005BD3] hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
