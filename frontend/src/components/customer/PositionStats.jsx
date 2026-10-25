import ProgressBar from '../ui/ProgressBar';
import { formatMinutes } from '../../lib/formatters';

export default function PositionStats({ ahead, minutes, progress, nowServing }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
          <dt className="text-sm text-black/55 dark:text-white/55">People ahead</dt>
          <dd className="mt-1 text-3xl font-medium tabular-nums">{ahead}</dd>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
          <dt className="text-sm text-black/55 dark:text-white/55">Estimated wait</dt>
          <dd className="mt-1 text-3xl font-medium tabular-nums">{ahead === 0 ? 'Next' : formatMinutes(minutes)}</dd>
        </div>
      </dl>
      <div>
        <ProgressBar value={progress} max={100} tone="brand" height="h-2" label="Your progress in the line" />
        <div className="mt-2 flex justify-between text-sm text-black/55 dark:text-white/55">
          <span>Joined</span>
          <span>Now serving: <strong className="font-medium text-[#1A1A1A] dark:text-white">{nowServing ?? 'Starting soon'}</strong></span>
        </div>
      </div>
    </div>
  );
}
