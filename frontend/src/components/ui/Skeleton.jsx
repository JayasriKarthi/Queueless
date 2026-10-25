import { cx } from '../../lib/cx';

export default function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded-md bg-[#E3E3E3] dark:bg-neutral-800', className)} aria-hidden="true" />;
}

export function SkeletonCard({ lines = 3, className }) {
  return (
    <div className={cx('ql-card p-4 space-y-3', className)} role="status" aria-label="Loading">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cx('h-3', i % 2 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-48" />
      <SkeletonCard lines={4} />
      <SkeletonCard lines={6} />
    </div>
  );
}
