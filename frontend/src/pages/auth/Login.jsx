import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Store, UserRound } from 'lucide-react';
import AuthShell from './AuthShell';
import Input from '../../components/ui/Input';
import PasswordInput from '../../components/ui/PasswordInput';
import Button from '../../components/ui/Button';
import Banner from '../../components/ui/Banner';
import Modal from '../../components/ui/Modal';
import { loginSchema, emailRule } from '../../lib/validators';
import { login, requestPasswordReset } from '../../lib/fakeBackend';
import { DEMO_PASSWORD } from '../../config/constants';

function ForgotPassword({ open, onClose }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const send = async () => {
    const r = emailRule.safeParse(email);
    if (!r.success) return setError(r.error.issues[0].message);
    setError('');
    setState('sending');
    const res = await requestPasswordReset(email);
    if (!res.ok) {
      setState('idle');
      return setError(res.error);
    }
    setState('sent');
  };
  const close = () => {
    onClose();
    setTimeout(() => setState('idle'), 200);
  };
  return (
    <Modal open={open} onClose={close} title="Reset your password" size="sm" footer={state === 'sent' ? <Button variant="primary" onClick={close}>Done</Button> : <><Button onClick={close}>Cancel</Button><Button variant="primary" loading={state === 'sending'} onClick={send}>Send reset link</Button></>}>
      {state === 'sent' ? (
        <p role="status">If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox (and spam folder).</p>
      ) : (
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} autoComplete="email" />
      )}
    </Modal>
  );
}

// Everyone logs in here. Owners go to /admin, staff to /staff.
export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [formError, setFormError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema) });

  const finish = async (email, password) => {
    setFormError('');
    const res = await login(email, password);
    if (!res.ok) return setFormError(res.error);
    const next = params.get('next');
    navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : res.home, { replace: true });
  };
  const onSubmit = ({ email, password }) => finish(email, password);
  const [demoLoading, setDemoLoading] = useState(null);
  const demo = async (email) => {
    setValue('email', email);
    setValue('password', DEMO_PASSWORD);
    setDemoLoading(email);
    await finish(email, DEMO_PASSWORD);
    setDemoLoading(null);
  };

  return (
    <AuthShell panelTitle="Welcome back. Your line is waiting.">
      <h1 className="text-[28px] font-medium tracking-tight">Log in to QueueLess</h1>
      <p className="mt-1 text-sm text-admin-muted">For business owners and staff. Customers never need an account.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        {formError && <Banner tone="critical">{formError}</Banner>}
        {params.get('next') && !formError && <Banner tone="info">Please log in to continue.</Banner>}
        <Input label="Email" type="email" autoComplete="email" inputClassName="h-11" error={errors.email?.message} {...register('email')} />
        <div>
          <PasswordInput label="Password" autoComplete="current-password" inputClassName="h-11" error={errors.password?.message} {...register('password')} />
          <button type="button" className="mt-1.5 text-[13px] text-[#005BD3] hover:underline" onClick={() => setForgotOpen(true)}>
            Forgot password?
          </button>
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
          Log in
        </Button>
      </form>
      <div className="mt-6 rounded-xl border border-dashed border-admin-border p-4">
        <p className="text-[13px] font-medium">Try the demo</p>
        <p className="ql-subdued">Password for both: {DEMO_PASSWORD} (after running npm run seed in the backend)</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button icon={Store} loading={demoLoading === 'owner@demo.com'} onClick={() => demo('owner@demo.com')}>Demo as owner</Button>
          <Button icon={UserRound} loading={demoLoading === 'staff@demo.com'} onClick={() => demo('staff@demo.com')}>Demo as staff</Button>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-admin-muted">
        New to QueueLess? <Link to="/signup" className="font-medium text-[#005BD3] hover:underline">Start free</Link>
      </p>
      <ForgotPassword open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </AuthShell>
  );
}
