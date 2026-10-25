import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Checkbox from '../ui/Checkbox';
import Toggle from '../ui/Toggle';
import Button from '../ui/Button';
import { serviceSchema } from '../../lib/validators';

export default function ServiceForm({ business, service, onSubmit, onCancel, onDelete }) {
  const handledBy = service ? business.resources.filter((r) => r.serviceIds.includes(service.id)).map((r) => r.id) : business.resources.map((r) => r.id);
  const { register, handleSubmit, control, watch, formState: { errors, isDirty, isSubmitting } } = useForm({
    resolver: zodResolver(serviceSchema),
    defaultValues: { name: service?.name ?? '', avgMinutes: service?.avgMinutes ?? 10, prefix: service?.prefix ?? 'A', handledBy, isActive: service?.isActive ?? true },
  });
  const prefix = watch('prefix');
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <Card>
          <div className="space-y-4">
            <Input label="Service name" placeholder="For example, General consultation" error={errors.name?.message} {...register('name')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Average minutes per customer" type="number" min={1} help="Used for wait estimates" error={errors.avgMinutes?.message} {...register('avgMinutes')} />
              <Input
                label="Token prefix"
                maxLength={2}
                help={`Tokens look like ${(prefix || 'A').toUpperCase()}-001${business.settings.queueMode === 'shared' ? '. Shared lines use the prefix from Queue rules.' : ''}`}
                error={errors.prefix?.message}
                {...register('prefix', { setValueAs: (v) => v.toUpperCase() })}
              />
            </div>
          </div>
        </Card>
        <Card title={`Handled by`} subtitle={`Which ${business.labels.resourcePlural.toLowerCase()} can serve this service`}>
          <Controller
            control={control}
            name="handledBy"
            render={({ field }) => (
              <div className="space-y-2">
                {business.resources.map((r) => (
                  <Checkbox
                    key={r.id}
                    label={r.name}
                    help={r.isActive ? null : 'Inactive'}
                    checked={field.value.includes(r.id)}
                    onChange={(e) => field.onChange(e.target.checked ? [...field.value, r.id] : field.value.filter((x) => x !== r.id))}
                  />
                ))}
                {business.resources.length === 0 && <p className="ql-subdued">Add a {business.labels.resource.toLowerCase()} first.</p>}
              </div>
            )}
          />
        </Card>
      </div>
      <div className="space-y-4">
        <Card title="Status">
          <Controller control={control} name="isActive" render={({ field }) => <Toggle label="Active" help="Inactive services are hidden from the join page" checked={field.value} onChange={field.onChange} />} />
        </Card>
        {onDelete && (
          <Card title="Delete service">
            <p className="ql-subdued mb-3">Past tokens keep their history.</p>
            <Button variant="destructive" size="sm" onClick={onDelete}>Delete service</Button>
          </Card>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-admin-border pt-4 lg:col-span-2 dark:border-neutral-800">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" loading={isSubmitting} disabled={service && !isDirty}>Save</Button>
      </div>
    </form>
  );
}
