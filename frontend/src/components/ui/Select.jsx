import { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from '../../lib/cx';
import Field from './Field';

const Select = forwardRef(function Select({ label, help, error, options = [], className, placeholder, optional, selectClassName, ...rest }, ref) {
  const id = useId();
  return (
    <Field id={id} label={label} help={help} error={error} className={className} optional={optional}>
      <div className="relative">
        <select ref={ref} id={id} aria-invalid={error ? true : undefined} className={cx('ql-input appearance-none pr-8', selectClassName)} {...rest}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => {
            const opt = typeof o === 'string' ? { value: o, label: o } : o;
            return (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            );
          })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-admin-muted" aria-hidden="true" />
      </div>
    </Field>
  );
});

export default Select;
