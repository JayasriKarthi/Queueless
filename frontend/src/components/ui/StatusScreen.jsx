import { cx } from '../../lib/cx';

// Full-page message used for not found, access denied, closed, and similar states.
export default function StatusScreen({ icon: Icon, title, children, actions, tone = 'neutral', className }) {
  return (
    <div className={cx('flex min-h-[60vh] items-center justify-center p-4', className)}>
      <div className="w-full max-w-md text-center">
        {Icon && (
          <span className={cx('mx-auto flex h-14 w-14 items-center justify-center rounded-full', tone === 'critical' ? 'bg-[#FEE9E8] text-[#8E0B21]' : 'bg-[#F1F1F1] text-[#303030] dark:bg-neutral-800 dark:text-neutral-200')}>
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
        )}
        <h1 className="mt-4 text-xl font-medium tracking-tight">{title}</h1>
        {children && <div className="mt-2 text-sm text-admin-muted dark:text-neutral-400">{children}</div>}
        {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
