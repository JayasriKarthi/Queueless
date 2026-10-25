import { ArrowUp, ArrowDown, Trash2, Plus, Lock } from 'lucide-react';
import { FIELD_TYPES } from '../../config/constants';
import Button from '../ui/Button';
import Toggle from '../ui/Toggle';

const keyFrom = (label, existing) => {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'field';
  let key = base;
  let n = 2;
  while (existing.includes(key)) key = `${base}_${n++}`;
  return key;
};

// Add, remove, reorder, and configure join-form fields. Name and phone are always required.
export default function FieldBuilder({ fields, onChange }) {
  const update = (i, patch) => onChange(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const move = (i, dir) => {
    const next = [...fields];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange(next);
  };
  const add = () => onChange([...fields, { key: keyFrom('New field', fields.map((f) => f.key)), label: 'New field', type: 'text', required: false }]);

  return (
    <div className="space-y-2">
      {fields.map((f, i) => (
        <div key={f.key} className="rounded-xl border border-admin-border p-3 dark:border-neutral-700">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[160px] flex-1">
              <span className="ql-label">Label</span>
              <input className="ql-input" value={f.label} disabled={f.locked} onChange={(e) => update(i, { label: e.target.value })} />
            </label>
            <label className="w-36">
              <span className="ql-label">Type</span>
              <select className="ql-input" value={f.type} disabled={f.locked} onChange={(e) => update(i, { type: e.target.value, options: e.target.value === 'select' ? f.options ?? ['Option 1', 'Option 2'] : undefined })}>
                {FIELD_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-1 pb-0.5">
              <Button variant="ghost" size="icon" aria-label={`Move ${f.label} up`} disabled={i === 0} onClick={() => move(i, -1)} icon={ArrowUp} />
              <Button variant="ghost" size="icon" aria-label={`Move ${f.label} down`} disabled={i === fields.length - 1} onClick={() => move(i, 1)} icon={ArrowDown} />
              {f.locked ? (
                <span className="flex h-9 w-9 items-center justify-center text-admin-muted" title="Always required"><Lock className="h-4 w-4" aria-label="Always required" /></span>
              ) : (
                <Button variant="ghost" size="icon" aria-label={`Remove ${f.label}`} onClick={() => onChange(fields.filter((_, idx) => idx !== i))} icon={Trash2} />
              )}
            </div>
          </div>
          {f.type === 'select' && (
            <label className="mt-2 block">
              <span className="ql-label">Options (comma separated)</span>
              <input className="ql-input" value={(f.options ?? []).join(', ')} onChange={(e) => update(i, { options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })} />
            </label>
          )}
          <Toggle className="mt-3" label="Required" checked={f.required} disabled={f.locked} onChange={(v) => update(i, { required: v })} />
        </div>
      ))}
      <Button icon={Plus} onClick={add}>Add field</Button>
    </div>
  );
}
