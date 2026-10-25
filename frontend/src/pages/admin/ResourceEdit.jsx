import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTenant, useUsage } from '../../hooks/useTenant';
import { saveResource, deleteResources } from '../../lib/fakeBackend';
import { resourceSchema } from '../../lib/validators';
import { toast } from '../../store/uiStore';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Checkbox from '../../components/ui/Checkbox';
import Toggle from '../../components/ui/Toggle';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import UpgradePrompt from '../../components/admin/UpgradePrompt';
import NotFound from '../NotFound';

export default function ResourceEdit() {
  const { id } = useParams();
  const { business } = useTenant();
  const usage = useUsage(business);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const resource = id ? business.resources.find((r) => r.id === id) : null;
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(resourceSchema),
    defaultValues: { name: resource?.name ?? '', serviceIds: resource?.serviceIds ?? business.services.map((s) => s.id).slice(0, 1), isActive: resource?.isActive ?? true },
  });
  if (id && !resource) return <NotFound inline />;
  const one = business.labels.resource;

  const onSubmit = (data) => {
    const res = saveResource(business.id, data, resource?.id);
    if (!res.ok) return setLimitOpen(true);
    toast(resource ? `${one} saved` : `${one} added`);
    navigate('/admin/resources');
  };
  const onDelete = () => {
    const res = deleteResources(business.id, [resource.id]);
    setConfirm(false);
    if (!res.ok) return toast(res.error, { tone: 'critical' });
    toast(`${one} deleted`);
    navigate('/admin/resources');
  };

  return (
    <div>
      <PageHeader back="/admin/resources" title={resource ? resource.name : `Add ${one.toLowerCase()}`} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Card>
            <Input label={`${one} name`} placeholder={one === 'Doctor' ? 'For example, Dr. Priya Nair' : 'For example, Counter 2'} error={errors.name?.message} {...register('name')} />
          </Card>
          <Card title="Services handled" subtitle={`Customers for these services can be called by this ${one.toLowerCase()}`}>
            <Controller
              control={control}
              name="serviceIds"
              render={({ field }) => (
                <div className="space-y-2">
                  {business.services.map((s) => (
                    <Checkbox key={s.id} label={s.name} checked={field.value.includes(s.id)} onChange={(e) => field.onChange(e.target.checked ? [...field.value, s.id] : field.value.filter((x) => x !== s.id))} />
                  ))}
                  {errors.serviceIds && <p className="ql-error">{errors.serviceIds.message}</p>}
                </div>
              )}
            />
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Status">
            <Controller control={control} name="isActive" render={({ field }) => <Toggle label="Active" help={`Plan usage: ${usage.counters.used} of ${usage.counters.limit === Infinity ? 'unlimited' : usage.counters.limit}`} checked={field.value} onChange={field.onChange} />} />
          </Card>
          {resource && (
            <Card title={`Delete ${one.toLowerCase()}`}>
              <Button variant="destructive" size="sm" onClick={() => setConfirm(true)}>Delete</Button>
            </Card>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-admin-border pt-4 lg:col-span-2 dark:border-neutral-800">
          <Button onClick={() => navigate('/admin/resources')}>Cancel</Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>Save</Button>
        </div>
      </form>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={onDelete} title={`Delete ${resource?.name}?`} message="People already waiting stay in line." confirmLabel="Delete" />
      <UpgradePrompt open={limitOpen} onClose={() => setLimitOpen(false)} limitKey="counters" usage={usage.counters} />
    </div>
  );
}
