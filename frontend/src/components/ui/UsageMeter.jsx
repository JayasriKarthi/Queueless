import { formatNumber } from '../../lib/formatters';
import ProgressBar from './ProgressBar';

export default function UsageMeter({ label, used, limit, help }) {
  const unlimited = limit === Infinity;
  const ratio = unlimited ? 0 : used / (limit || 1);
  const tone = ratio >= 1 ? 'critical' : ratio >= 0.8 ? 'attention' : 'teal';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="font-medium">{label}</span>
        <span className="text-admin-muted">
          {formatNumber(used)} of {formatNumber(limit)}
          {ratio >= 1 && !unlimited && <span className="ml-1 text-[#8E0B21] dark:text-red-300">(limit reached)</span>}
        </span>
      </div>
      <ProgressBar value={used} max={limit} tone={tone} className="mt-1.5" label={`${label}: ${used} of ${formatNumber(limit)}`} />
      {help && <p className="ql-help mt-1">{help}</p>}
    </div>
  );
}
