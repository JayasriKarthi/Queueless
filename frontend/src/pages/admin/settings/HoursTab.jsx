import { DAYS } from '../../../config/constants';
import Toggle from '../../../components/ui/Toggle';
import Button from '../../../components/ui/Button';

export default function HoursTab({ draft, update }) {
  const setDay = (id, patch) => update({ hours: { ...draft.hours, [id]: { ...draft.hours[id], ...patch } } });
  const copyMonday = () => update({ hours: Object.fromEntries(DAYS.map((d) => [d.id, d.id === 'sun' ? draft.hours.sun : { ...draft.hours.mon }])) });
  return (
    <div className="max-w-2xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-admin-muted">Shown on your join page. Use "Pause queue" on the Channels page to close early.</p>
        <Button size="sm" onClick={copyMonday}>Copy Monday to weekdays and Saturday</Button>
      </div>
      <ul className="divide-y divide-admin-border rounded-xl border border-admin-border dark:divide-neutral-800 dark:border-neutral-700">
        {DAYS.map((d) => {
          const h = draft.hours[d.id];
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <span className="w-24 text-[13px] font-medium">{d.label}</span>
              <Toggle checked={h.open} onChange={(open) => setDay(d.id, { open })} ariaLabel={`Open on ${d.label}`} />
              {h.open ? (
                <div className="flex items-center gap-2 text-[13px]">
                  <input type="time" aria-label={`${d.label} opens`} className="ql-input w-28" value={h.from} onChange={(e) => setDay(d.id, { from: e.target.value })} />
                  <span>to</span>
                  <input type="time" aria-label={`${d.label} closes`} className="ql-input w-28" value={h.to} onChange={(e) => setDay(d.id, { to: e.target.value })} />
                </div>
              ) : (
                <span className="text-[13px] text-admin-muted">Closed</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
