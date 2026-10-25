import { useEffect } from 'react';
import { Delete } from 'lucide-react';
import { cx } from '../../lib/cx';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];

export default function PinKeypad({ value, onChange, onComplete, disabled, error }) {
  useEffect(() => {
    if (value.length === 4) onComplete(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if (disabled) return;
      if (/^\d$/.test(e.key) && value.length < 4) onChange(value + e.key);
      if (e.key === 'Backspace') onChange(value.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [value, disabled, onChange]);

  const press = (k) => {
    if (disabled) return;
    if (k === 'clear') onChange('');
    else if (k === 'back') onChange(value.slice(0, -1));
    else if (value.length < 4) onChange(value + k);
  };

  return (
    <div>
      <div className={cx('flex justify-center gap-3', error && 'animate-[pop_.2s]')} aria-label={`${value.length} of 4 digits entered`} role="status">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cx('h-4 w-4 rounded-full border-2', i < value.length ? 'border-[#303030] bg-[#303030] dark:border-white dark:bg-white' : 'border-[#8A8A8A]', error && 'border-[#E51C00]')} />
        ))}
      </div>
      <div className="mx-auto mt-6 grid max-w-[260px] grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => press(k)}
            className="flex h-16 items-center justify-center rounded-2xl bg-white text-xl font-medium shadow-card hover:bg-[#F7F7F7] active:scale-95 disabled:opacity-40 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            aria-label={k === 'back' ? 'Delete digit' : k === 'clear' ? 'Clear' : k}
          >
            {k === 'back' ? <Delete className="h-5 w-5" /> : k === 'clear' ? <span className="text-sm">Clear</span> : k}
          </button>
        ))}
      </div>
    </div>
  );
}
