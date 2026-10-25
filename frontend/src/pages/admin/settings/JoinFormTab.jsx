import FieldBuilder from '../../../components/admin/FieldBuilder';
import DynamicField from '../../../components/customer/DynamicField';

export default function JoinFormTab({ draft, update }) {
  const fields = draft.settings.customerFields;
  const setFields = (customerFields) => update({ settings: { ...draft.settings, customerFields } });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <p className="mb-3 text-[13px] text-admin-muted">Name and a 10-digit mobile number are always required. Add anything else you need before serving someone.</p>
        <FieldBuilder fields={fields} onChange={setFields} />
      </div>
      <div>
        <p className="ql-subdued mb-1.5">Preview</p>
        <div className="space-y-3 rounded-2xl border border-admin-border bg-[#F6F7F8] p-4 dark:border-neutral-700 dark:bg-neutral-950" aria-label="Join form preview">
          {fields.map((f) => <DynamicField key={f.key} field={f} preview />)}
        </div>
      </div>
    </div>
  );
}
