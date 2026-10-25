import { MoreHorizontal, PhoneCall, ArrowDownToLine, Trash2 } from 'lucide-react';
import Menu from '../ui/Menu';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import { useNow } from '../../hooks/useCountdown';
import { minutesBetween } from '../../lib/formatters';

// Sorted by priority, then arrival. Row menu: call this one, skip to end, remove.
export default function WaitingList({ business, tokens, onCall, onSkip, onRemove, limit, title = 'Waiting' }) {
  useNow(30000);
  const shown = limit ? tokens.slice(0, limit) : tokens;
  return (
    <section className="ql-card" aria-labelledby="waiting-title">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 id="waiting-title" className="text-[13px] font-medium">{title}</h2>
        <Badge tone="info">{tokens.length}</Badge>
      </div>
      {tokens.length === 0 ? (
        <div className="px-4 pb-4">
          <EmptyState compact title="No one is waiting" description="New customers appear here as soon as they join." />
        </div>
      ) : (
        <ol className="border-t border-admin-border dark:border-neutral-800" aria-live="polite">
          {shown.map((t, i) => {
            const service = business.services.find((s) => s.id === t.serviceId);
            return (
              <li key={t.id} className="flex items-center gap-3 border-b border-admin-border px-4 py-2.5 last:border-0 hover:bg-[#F7F7F7] dark:border-neutral-800 dark:hover:bg-neutral-800/50">
                <span className="w-5 text-xs text-admin-muted">{i + 1}</span>
                <span className="w-14 font-medium">{t.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{t.customer.name}</span>
                  <span className="block truncate text-xs text-admin-muted">{service?.name}{t.source === 'walk-in' ? ' · walk-in' : ''}</span>
                </span>
                {t.priority && <Badge tone="attention">Priority</Badge>}
                <span className="hidden w-16 text-right text-xs text-admin-muted sm:block">{minutesBetween(t.createdAt)} min</span>
                <Menu
                  trigger={(props) => (
                    <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label={`Actions for ${t.code}`} {...props}>
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  )}
                  items={[
                    onCall && { label: 'Call this one', icon: PhoneCall, onClick: () => onCall(t) },
                    { label: 'Skip to end', icon: ArrowDownToLine, onClick: () => onSkip(t) },
                    { divider: true },
                    { label: 'Remove', icon: Trash2, tone: 'critical', onClick: () => onRemove(t) },
                  ]}
                />
              </li>
            );
          })}
        </ol>
      )}
      {limit && tokens.length > limit && <p className="border-t border-admin-border px-4 py-2 text-xs text-admin-muted dark:border-neutral-800">And {tokens.length - limit} more</p>}
    </section>
  );
}
