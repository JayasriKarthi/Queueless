import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sparkles } from 'lucide-react';
import AuthShell from './AuthShell';
import Input from '../../components/ui/Input';
import PasswordInput from '../../components/ui/PasswordInput';
import PasswordStrength from '../../components/ui/PasswordStrength';
import Select from '../../components/ui/Select';
import Checkbox from '../../components/ui/Checkbox';
import Button from '../../components/ui/Button';
import Banner from '../../components/ui/Banner';
import { signupSchema } from '../../lib/validators';
import { signup } from '../../lib/fakeBackend';
import { BUSINESS_TYPES } from '../../config/constants';
import { PLANS } from '../../config/plans';
import { toast } from '../../store/uiStore';

export default function Signup() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const plan = PLANS.find((p) => p.id === params.get('plan') && p.id !== 'enterprise');
  const presetType = BUSINESS_TYPES.some((t) => t.id === params.get('type')) ? params.get('type') : '';
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: params.get('email') ?? '', businessType: presetType, terms: false },
  });

  const onSubmit = async (data) => {
    const res = await signup({ ...data, plan: plan?.id });
    if (!res.ok) {
      // The server names the field for each problem; anything else goes under the email.
      const fields = (res.details ?? []).filter((d) => d.field in data);
      if (fields.length) fields.forEach((d) => setError(d.field, { message: d.message }));
      else setError('email', { message: res.error });
      return;
    }
    toast(`Welcome to QueueLess, ${data.name.split(' ')[0]}`);
    navigate('/onboarding/welcome');
  };

  return (
    <AuthShell>
      <h1 className="text-[28px] font-medium tracking-tight">Create your QueueLess account</h1>
      <p className="mt-1 text-sm text-admin-muted">Free plan available. No credit card required.</p>
      {plan && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-[13px] text-teal-900">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> You chose the {plan.name} plan. You can change it later.
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
        <Input label="Full name" autoComplete="name" inputClassName="h-11" error={errors.name?.message} {...register('name')} />
        <Input label="Work email" type="email" autoComplete="email" inputClassName="h-11" error={errors.email?.message} {...register('email')} />
        <div>
          <PasswordInput label="Password" autoComplete="new-password" inputClassName="h-11" help="At least 8 characters" error={errors.password?.message} {...register('password')} />
          <PasswordStrength value={watch('password')} />
        </div>
        <Input label="Business name" autoComplete="organization" inputClassName="h-11" help="This creates your public link, for example queueless.app/your-business" error={errors.businessName?.message} {...register('businessName')} />
        <Select label="Business type" placeholder="Choose one" selectClassName="h-11" options={BUSINESS_TYPES.map((t) => ({ value: t.id, label: t.label }))} error={errors.businessType?.message} {...register('businessType')} />
        <Checkbox label="I agree to the terms of service and privacy policy" error={errors.terms?.message} {...register('terms')} />
        {Object.keys(errors).length > 1 && <Banner tone="critical">Please fix the highlighted fields.</Banner>}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-admin-muted">
        Already have an account? <Link to="/login" className="font-medium text-[#005BD3] hover:underline">Log in</Link>
      </p>
    </AuthShell>
  );
}
