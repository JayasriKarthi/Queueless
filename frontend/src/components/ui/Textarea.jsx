import { forwardRef, useId } from 'react';
import { cx } from '../../lib/cx';
import Field from './Field';

const Textarea = forwardRef(function Textarea({ label, help, error, className, rows = 3, optional, ...rest }, ref) {
  const id = useId();
  return (
    <Field id={id} label={label} help={help} error={error} className={className} optional={optional}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cx('ql-input h-auto py-2 resize-y', error && 'border-red-500')}
        {...rest}
      />
    </Field>
  );
});

export default Textarea;
