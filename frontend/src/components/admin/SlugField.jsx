import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, History } from 'lucide-react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import { checkSlugAvailability, changeSlug } from '../../lib/fakeBackend';
import { formatDate, publicUrl } from '../../lib/formatters';
import { toast } from '../../store/uiStore';
import { SLUG_REDIRECT_DAYS } from '../../config/constants';

export default function SlugField({ business }) {
  const [value, setValue] = useState(business.slug);
  const [check, setCheck] = useState(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setValue(business.slug), [business.slug]);
  useEffect(() => {
    const id = setTimeout(() => setCheck(checkSlugAvailability(value, business.id)), 250);
    return () => clearTimeout(id);
  }, [value, business.id]);

  const changed = value !== business.slug;
  const save = () => {
    const res = changeSlug(business.id, value);
    setConfirm(false);
    toast(res.ok ? (changed ? `Your link is now /${value}` : 'Link confirmed') : res.error, { tone: res.ok ? 'default' : 'critical' });
  };
  const history = (business.slugHistory ?? []).filter((h) => h.redirectUntil > Date.now());

  return (
    <div>
      <Input
        label="Public link"
        prefix={<span className="text-xs">/</span>}
        value={value}
        onChange={(e) => setValue(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
        help={`${publicUrl('/')}${value}`}
        maxLength={40}
        autoComplete="off"
      />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2" aria-live="polite">
        {check && (
          <span className={`inline-flex items-center gap-1 text-xs ${check.available ? 'text-[#0C5132] dark:text-emerald-300' : 'text-[#8E0B21] dark:text-red-300'}`}>
            {check.available ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
            {check.reason}
          </span>
        )}
        <Button size="sm" variant={changed ? 'primary' : 'secondary'} disabled={!check?.available || (!changed && business.setup?.slugConfirmed)} onClick={() => (changed && business.isLive ? setConfirm(true) : save())}>
          {changed ? 'Change link' : business.setup?.slugConfirmed ? 'Confirmed' : 'Confirm link'}
        </Button>
      </div>
      <p className="ql-help mt-2">Lowercase letters, numbers, and hyphens. 3 to 40 characters. Some names like admin or login are reserved.</p>
      {history.length > 0 && (
        <div className="mt-3 rounded-lg bg-[#F7F7F7] p-3 text-[13px] dark:bg-neutral-800">
          <p className="flex items-center gap-1.5 font-medium"><History className="h-4 w-4" aria-hidden="true" /> Old links still redirecting</p>
          <ul className="mt-1.5 space-y-1">
            {history.map((h) => (
              <li key={h.slug} className="flex justify-between gap-2">
                <span className="font-mono">/{h.slug}</span>
                <span className="text-admin-muted">until {formatDate(h.redirectUntil)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={save}
        title="Change your public link?"
        message={`Your printed QR codes will stop working. We will keep redirecting your old link for ${SLUG_REDIRECT_DAYS} days.`}
        checkboxLabel={`I understand that /${business.slug} will stop working after ${SLUG_REDIRECT_DAYS} days`}
        confirmLabel="Change link"
      />
    </div>
  );
}
