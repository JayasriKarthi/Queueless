import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Drawer from '../ui/Drawer';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import Banner from '../ui/Banner';
import UsageMeter from '../ui/UsageMeter';
import { inviteSchema } from '../../lib/validators';
import { createInvite } from '../../lib/fakeBackend';
import { INVITE_EXPIRY_DAYS } from '../../config/constants';

export default function InviteStaffPanel({ open, onClose, business, usage, onSent }) {
  const full = usage.staffSeats.used >= usage.staffSeats.limit;
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(inviteSchema) });
  useEffect(() => {
    if (open) reset({ email: '', role: 'staff', resourceId: business.resources[0]?.id ?? '' });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data) => {
    await new Promise((r) => setTimeout(r, 400));
    const res = createInvite(business.id, data);
    if (!res.ok) return setError('email', { message: res.error === 'seat_limit' ? 'All staff seats are in use. Upgrade to add more.' : res.error });
    onSent(res.invite);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Invite staff"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          {full ? <Button variant="primary" to="/admin/billing?upgrade=pro">Upgrade for more seats</Button> : <Button variant="primary" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>Send invite</Button>}
        </>
      }
    >
      <div className="space-y-4">
        <UsageMeter label="Staff seats" used={usage.staffSeats.used} limit={usage.staffSeats.limit} help="Active staff and pending invites both use a seat." />
        {full ? (
          <Banner tone="warning" title="No seats left on your plan">Revoke a pending invite, deactivate someone, or upgrade. Nobody is removed automatically.</Banner>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <Input label="Email" type="email" autoComplete="off" error={errors.email?.message} {...register('email')} data-autofocus />
            <Select label="Role" options={[{ value: 'staff', label: 'Staff: runs the console' }, { value: 'manager', label: 'Manager: console plus all lines' }]} {...register('role')} />
            <Select label={`Assigned ${business.labels.resource.toLowerCase()}`} error={errors.resourceId?.message} options={business.resources.map((r) => ({ value: r.id, label: r.name }))} {...register('resourceId')} />
            <p className="ql-subdued">The invite link expires in {INVITE_EXPIRY_DAYS} days. Staff set their own password and log in at the normal login page.</p>
          </form>
        )}
      </div>
    </Drawer>
  );
}
