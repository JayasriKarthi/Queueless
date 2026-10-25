import { PhoneCall, Check, UserX, RotateCcw, UserCheck } from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { useNow } from '../../hooks/useCountdown';
import { formatDuration } from '../../lib/formatters';
import { cx } from '../../lib/cx';

export default function NowServingPanel({ business, resource, current, waitingCount, actions, onNoShow, compact }) {
  const now = useNow(1000);
  const service = current && business.services.find((s) => s.id === current.serviceId);
  const extraFields = business.settings.customerFields.filter((f) => !['name', 'phone'].includes(f.key));
  const startedAt = current?.servedAt ?? current?.calledAt;
  const disabled = resource.isPaused;

  return (
    <section className="ql-card p-4 sm:p-5" aria-labelledby={`now-${resource.id}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={`now-${resource.id}`} className="text-[13px] font-medium text-admin-muted">Now serving{compact && ` · ${resource.name}`}</h2>
        {current && (
          <Badge tone={current.status === 'SERVING' ? 'success' : 'attention'} dot>
            {current.status === 'SERVING' ? 'Serving' : 'Called'} {formatDuration(now - startedAt)}
          </Badge>
        )}
      </div>
      <div aria-live="polite">
        {current ? (
          <div className="mt-2">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <p className={cx('font-medium tracking-tight', compact ? 'text-3xl' : 'text-5xl')}>{current.code}</p>
              {current.priority && <Badge tone="attention">Priority</Badge>}
              {current.recalls > 0 && <Badge tone="neutral">Recalled {current.recalls}×</Badge>}
            </div>
            <p className="mt-1 text-[15px] font-medium">{current.customer.name}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-3">
              <div><dt className="ql-subdued">Mobile</dt><dd>{current.customer.phone}</dd></div>
              <div><dt className="ql-subdued">{business.labels.service}</dt><dd>{service?.name ?? 'Removed service'}</dd></div>
              {!compact && extraFields.map((f) => (
                <div key={f.key}><dt className="ql-subdued">{f.label}</dt><dd>{current.customer[f.key] ?? '–'}</dd></div>
              ))}
            </dl>
          </div>
        ) : (
          <p className="mt-3 text-[15px] text-admin-muted">No one is being served. {waitingCount ? `${waitingCount} waiting.` : 'The line is empty.'}</p>
        )}
      </div>
      <div className={cx('mt-4 grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
        <Button variant="primary" size="lg" icon={PhoneCall} className={cx('min-h-[44px]', compact ? 'col-span-2' : 'col-span-2 sm:col-span-4 h-12 text-base')} onClick={() => actions.callNext(resource.id)} disabled={disabled || (!waitingCount && !current)}>
          Call next{!compact && <kbd className="ml-1 rounded border border-white/30 px-1 text-[11px] font-normal">N</kbd>}
        </Button>
        {current?.status === 'CALLED' && !compact && (
          <Button size="lg" icon={UserCheck} className="min-h-[44px]" onClick={() => actions.arrived(current)}>Arrived</Button>
        )}
        <Button size="lg" icon={Check} className="min-h-[44px]" disabled={!current} onClick={() => actions.done(current)}>Mark done</Button>
        <Button size="lg" icon={UserX} className="min-h-[44px]" disabled={!current} onClick={() => onNoShow(current)}>No-show</Button>
        <Button size="lg" icon={RotateCcw} className="min-h-[44px]" disabled={!current} onClick={() => actions.recall(current)}>Recall</Button>
      </div>
      {disabled && <p className="ql-subdued mt-2">This {business.labels.resource.toLowerCase()} is paused. Resume to call the next person.</p>}
    </section>
  );
}
