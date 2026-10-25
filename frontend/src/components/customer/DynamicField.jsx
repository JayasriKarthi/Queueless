import { useId } from 'react';
import { customerInput } from './styles';

// Renders one join-form field from the business's customerFields config.
export default function DynamicField({ field, register, error, preview }) {
  const id = useId();
  const reg = preview ? { readOnly: true, tabIndex: -1 } : register(field.key);
  const common = { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-e` : undefined, ...reg };
  let control;
  if (field.type === 'select') {
    control = (
      <select className={`${customerInput} appearance-none`} {...common} disabled={preview}>
        <option value="">Choose one</option>
        {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  } else if (field.type === 'textarea') {
    control = <textarea rows={3} className={`${customerInput} h-auto py-3`} {...common} />;
  } else {
    const isPhone = field.key === 'phone';
    control = (
      <input
        type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : isPhone ? 'tel' : 'text'}
        inputMode={isPhone || field.type === 'number' ? 'numeric' : undefined}
        maxLength={isPhone ? 10 : undefined}
        autoComplete={field.key === 'name' ? 'name' : isPhone ? 'tel-national' : 'off'}
        placeholder={isPhone ? '10-digit mobile number' : undefined}
        className={customerInput}
        {...common}
      />
    );
  }
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {field.label}
        {!field.required && <span className="ml-1 font-normal text-black/45 dark:text-white/45">(optional)</span>}
      </label>
      {control}
      {error && <p id={`${id}-e`} role="alert" className="mt-1 text-sm text-[#B42318] dark:text-red-400">{error}</p>}
    </div>
  );
}
