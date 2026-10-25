import { useId } from 'react';
import { cx } from '../../lib/cx';

export default function Toggle({ checked, onChange, label, help, disabled, className, size = 'md', ariaLabel }) {
  const id = useId();
  const big = size === 'lg';
  return (
    <div className={cx('flex items-start justify-between gap-4', className)}>
      {label && (
        <label htmlFor={id} className="text-sm cursor-pointer">
          <span className="font-medium">{label}</span>
          {help && <span className="block ql-help mt-0.5">{help}</span>}
        </label>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label ? undefined : ariaLabel ?? 'Toggle'}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative inline-flex shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          big ? 'h-7 w-12' : 'h-5 w-9',
          checked ? 'bg-[#303030] dark:bg-teal' : 'bg-[#C9C9C9] dark:bg-neutral-700',
        )}
      >
        <span className={cx('inline-block rounded-full bg-white shadow transition-transform', big ? 'h-5 w-5' : 'h-3.5 w-3.5', checked ? (big ? 'translate-x-6' : 'translate-x-[18px]') : 'translate-x-1')} />
      </button>
    </div>
  );
}
