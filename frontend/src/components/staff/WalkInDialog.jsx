import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Checkbox from '../ui/Checkbox';
import Button from '../ui/Button';
import { phoneRule } from '../../lib/validators';
import { joinQueue } from '../../lib/fakeBackend';
import { hasFeature } from '../../config/plans';
import { toast } from '../../store/uiStore';

const schema = z.object({ name: z.string().trim().min(2, 'Enter a name'), phone: phoneRule, serviceId: z.string().min(1), priority: z.boolean().optional() });

const ERRORS = { closed: 'The queue is paused. Reopen it to add walk-ins.', not_live: 'Go live before adding walk-ins.', limit: 'Daily token limit reached. Upgrade or raise the limit in Queue rules.' };

export default function WalkInDialog({ open, onClose, business, resource }) {
  const services = business.services.filter((s) => s.isActive && (business.settings.queueMode === 'shared' || resource.serviceIds.includes(s.id)));
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (open) reset({ name: '', phone: '', serviceId: services[0]?.id ?? '', priority: false });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const canPriority = business.settings.allowPriority && hasFeature(business.plan, 'priorityQueues');

  const onSubmit = (data) => {
    const customer = { name: data.name, phone: data.phone };
    const res = joinQueue(business.id, { serviceId: data.serviceId, resourceId: business.settings.queueMode === 'per_resource' ? resource.id : null, customer, priority: data.priority, source: 'walk-in' });
    if (!res.ok) return toast(ERRORS[res.error] ?? 'Could not add walk-in', { tone: 'critical' });
    toast(res.existing ? `${data.name} already has ${res.token.code}` : `Walk-in added: ${res.token.code}`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add a walk-in" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        <Input label="Customer name" error={errors.name?.message} {...register('name')} data-autofocus />
        <Input label="Mobile number" inputMode="numeric" maxLength={10} error={errors.phone?.message} {...register('phone')} />
        <Select label={business.labels.service} options={services.map((s) => ({ value: s.id, label: s.name }))} {...register('serviceId')} />
        {canPriority && <Checkbox label="Priority (senior citizen, pregnant, or special need)" {...register('priority')} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>Add to line</Button>
        </div>
      </form>
    </Modal>
  );
}
