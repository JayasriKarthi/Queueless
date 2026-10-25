import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cx } from '../../lib/cx';
import Sparkline from './Sparkline';

// Label with a dashed underline, big number, trend arrow, and sparkline.
// `goodWhenDown` flips colours for metrics like wait time or no-shows.
export default function MetricTile({ label, value, change, spark, goodWhenDown, hint, className }) {
  const up = change >= 0;
  const good = goodWhenDown ? !up : up;
  return (
    <div className={cx('min-w-[150px] flex-1 rounded-lg p-3 hover:bg-[#F7F7F7] dark:hover:bg-neutral-800', className)}>
      <p className="text-[13px] text-[#303030] dark:text-neutral-300">
        <span className="ql-dashed" title={hint}>{label}</span>
      </p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div>
          <p className="text-xl font-medium tracking-tight">{value}</p>
          {change != null && (
            <p className={cx('mt-0.5 inline-flex items-center gap-0.5 text-xs font-medium', good ? 'text-[#0C5132] dark:text-emerald-300' : 'text-[#8E0B21] dark:text-red-300')}>
              {up ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}
              <span className="sr-only">{up ? 'Up' : 'Down'}</span>
              {Math.abs(change)}%
            </p>
          )}
        </div>
        {spark && <Sparkline data={spark} color={good ? '#0E9F8E' : '#E51C00'} label={`${label} trend`} />}
      </div>
    </div>
  );
}
