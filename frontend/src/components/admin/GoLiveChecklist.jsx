import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Rocket } from 'lucide-react';
import { goLiveChecklist, goLive, changeSlug } from '../../lib/fakeBackend';
import { toast } from '../../store/uiStore';
import Button from '../ui/Button';
import { cx } from '../../lib/cx';

export default function GoLiveChecklist({ business }) {
  const items = goLiveChecklist(business);
  const ready = items.every((i) => i.done);
  const [busy, setBusy] = useState(null);
  const launch = async () => {
    setBusy('live');
    const res = await goLive(business.id);
    setBusy(null);
    toast(res.ok ? 'You are live. Customers can now join.' : res.error, { tone: res.ok ? 'default' : 'critical' });
  };
  const confirmSlug = async () => {
    setBusy('slug');
    const res = await changeSlug(business.id, business.slug);
    setBusy(null);
    toast(res.ok ? `Link confirmed: /${business.slug}` : res.error, { tone: res.ok ? 'default' : 'critical' });
  };
  return (
    <div>
      <p className="text-sm font-medium">Finish setup to unlock</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 text-[13px]">
            <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full', item.done ? 'bg-[#303030] text-white dark:bg-teal' : 'border-[1.5px] border-dashed border-[#8A8A8A]')}>
              {item.done && <Check className="h-3 w-3" aria-hidden="true" />}
            </span>
            <span className={cx('flex-1', item.done && 'text-admin-muted line-through')}>
              {item.label}
              <span className="sr-only">{item.done ? ' (done)' : ' (to do)'}</span>
            </span>
            {!item.done &&
              (item.id === 'slug' ? (
                <Button size="sm" loading={busy === 'slug'} onClick={confirmSlug}>Confirm /{business.slug}</Button>
              ) : (
                <Link to={item.to} className="text-[#005BD3] hover:underline dark:text-sky-400">Fix</Link>
              ))}
          </li>
        ))}
      </ul>
      <Button variant="primary" icon={Rocket} className="mt-4" disabled={!ready} loading={busy === 'live'} onClick={launch}>Go live</Button>
      {!ready && <p className="ql-subdued mt-2">The Go live button turns on when every item is done.</p>}
    </div>
  );
}
