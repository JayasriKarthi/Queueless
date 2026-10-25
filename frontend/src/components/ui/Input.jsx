import { forwardRef, useId } from 'react';
import { cx } from '../../lib/cx';
import Field from './Field';

const Input = forwardRef(function Input({ label, help, error, prefix, suffix, className, inputClassName, optional, id: idProp, ...rest }, ref) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <Field id={id} label={label} help={help} error={error} className={className} optional={optional}>
      <div className="relative flex items-center">
        {prefix && <span className="pointer-events-none absolute left-3 text-sm text-admin-muted">{prefix}</span>}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
          className={cx('ql-input', prefix && 'pl-8', suffix && 'pr-10', error && 'border-red-500 focus:ring-red-500', inputClassName)}
          {...rest}
        />
        {suffix && <span className="absolute right-2 flex items-center">{suffix}</span>}
      </div>
    </Field>
  );
});

export default Input;
