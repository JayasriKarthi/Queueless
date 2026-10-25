import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { useTenant } from '../../hooks/useTenant';
import { useAuthStore } from '../../store/authStore';
import { useCountdown } from '../../hooks/useCountdown';
import { switchUserWithPin } from '../../lib/fakeBackend';
import { toast } from '../../store/uiStore';
import Avatar from '../../components/ui/Avatar';
import PinKeypad from '../../components/staff/PinKeypad';
import Banner from '../../components/ui/Banner';
import { cx } from '../../lib/cx';

export default function SwitchUser() {
  const { business, user } = useTenant();
  const users = useAuthStore((s) => s.users);
  const lock = useAuthStore((s) => s.pinLocks[business.id]);
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const remaining = useCountdown(lock?.lockedUntil > Date.now() ? lock.lockedUntil : null);
  const locked = remaining > 0;
  const staff = users.filter((u) => u.businessId === business.id && u.role !== 'owner' && u.status === 'active');

  useEffect(() => {
    if (!locked && error.startsWith('Too many')) setError('');
  }, [locked, error]);

  const submit = (value) => {
    const res = switchUserWithPin(business.id, selected.id, value);
    setPin('');
    if (res.ok) {
      toast(`Switched to ${res.user.name}`);
      navigate('/staff');
    } else if (res.error === 'locked') setError('Too many wrong attempts. Try again in 30 seconds.');
    else if (res.error === 'wrong_pin') setError(`Wrong PIN. ${res.remaining} ${res.remaining === 1 ? 'try' : 'tries'} left before a short lock.`);
    else setError(res.error);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link to="/staff" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-admin-muted hover:text-[#1A1A1A] dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to console
      </Link>
      <h1 className="mt-2 text-xl font-medium tracking-tight">Who is using this computer?</h1>
      <p className="ql-subdued mt-1">{business.name}. Pick your name and enter your 4-digit PIN.</p>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {staff.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => {
                setSelected(u);
                setPin('');
                if (!locked) setError('');
              }}
              aria-pressed={selected?.id === u.id}
              className={cx('flex w-full flex-col items-center gap-2 rounded-2xl border-2 bg-white p-4 transition dark:bg-neutral-900', selected?.id === u.id ? 'border-[#303030] dark:border-white' : 'border-transparent shadow-card hover:border-admin-border')}
            >
              <Avatar name={u.name} color={u.avatarColor} size={52} />
              <span className="text-[13px] font-medium">{u.name}</span>
              {u.id === user.id && <span className="text-xs text-admin-muted">Signed in now</span>}
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <div className="ql-card mt-6 p-6">
          <p className="text-center text-[13px] font-medium">PIN for {selected.name}</p>
          <div className="mt-4" aria-live="assertive">
            {error && <Banner tone="critical" className="mb-4">{locked ? `${error} (${Math.ceil(remaining / 1000)}s)` : error}</Banner>}
          </div>
          {locked && <p className="mb-3 flex items-center justify-center gap-1.5 text-sm text-admin-muted"><Lock className="h-4 w-4" /> Locked for {Math.ceil(remaining / 1000)} seconds</p>}
          <PinKeypad value={pin} onChange={setPin} onComplete={submit} disabled={locked} error={Boolean(error)} />
          <p className="ql-subdued mt-4 text-center">Demo PIN for Rohan Iyer is 1234.</p>
        </div>
      )}
    </div>
  );
}
