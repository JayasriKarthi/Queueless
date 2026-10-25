import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import SlugField from '../../../components/admin/SlugField';
import { BUSINESS_TYPES } from '../../../config/constants';

export default function BusinessTab({ business, draft, update }) {
  const contact = (key) => (e) => update({ contact: { ...draft.contact, [key]: e.target.value } });
  const label = (key) => (e) => update({ labels: { ...draft.labels, [key]: e.target.value } });
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <Input label="Business name" value={draft.name} onChange={(e) => update({ name: e.target.value })} error={draft.name.trim() ? null : 'Business name is required'} />
        <Select label="Business type" value={draft.type} onChange={(e) => update({ type: e.target.value })} options={BUSINESS_TYPES.map((t) => ({ value: t.id, label: t.label }))} help="Changing the type keeps your current setup." />
        <div className="grid grid-cols-2 gap-3">
          <Input label="What you call one resource" value={draft.labels.resource} onChange={label('resource')} help="For example, Doctor" />
          <Input label="Plural" value={draft.labels.resourcePlural} onChange={label('resourcePlural')} help="Shown in the sidebar" />
        </div>
      </div>
      <div className="space-y-4">
        <SlugField business={business} />
        <Input label="Contact email" type="email" value={draft.contact.email} onChange={contact('email')} />
        <Input label="Contact phone" inputMode="tel" value={draft.contact.phone} onChange={contact('phone')} />
        <Input label="Address" value={draft.contact.address} onChange={contact('address')} />
      </div>
    </div>
  );
}
