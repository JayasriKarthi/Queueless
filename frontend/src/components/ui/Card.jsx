import { cx } from '../../lib/cx';

export default function Card({ title, subtitle, actions, children, className, padded = true, as: Tag = 'section' }) {
  return (
    <Tag className={cx('ql-card', className)}>
      {(title || actions) && (
        <div className={cx('flex items-start justify-between gap-3', padded ? 'px-4 pt-4' : 'px-4 py-3 border-b border-admin-border dark:border-neutral-800')}>
          <div className="min-w-0">
            {title && <h2 className="text-sm font-medium">{title}</h2>}
            {subtitle && <p className="ql-subdued mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cx(padded && 'p-4', padded && (title || actions) && 'pt-3')}>{children}</div>
    </Tag>
  );
}

export function CardSection({ title, children, className }) {
  return (
    <div className={cx('border-t border-admin-border px-4 py-4 first:border-t-0 dark:border-neutral-800', className)}>
      {title && <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-admin-muted">{title}</h3>}
      {children}
    </div>
  );
}
