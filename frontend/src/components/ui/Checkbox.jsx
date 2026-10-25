import { forwardRef, useId } from 'react';
import { cx } from '../../lib/cx';

const Checkbox = forwardRef(function Checkbox({ label, help, className, error, ...rest }, ref) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-start gap-2 cursor-pointer text-sm">
        <input ref={ref} id={id} type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-admin-input accent-[#303030] dark:accent-teal" {...rest} />
        <span className={cx('leading-5', !label && 'sr-only')}>
          {label}
          {help && <span className="block ql-help">{help}</span>}
        </span>
      </label>
      {error && <p className="ql-error">{error}</p>}
    </div>
  );
});

export default Checkbox;
