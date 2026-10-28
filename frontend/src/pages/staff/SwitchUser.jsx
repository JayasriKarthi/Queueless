import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { useTenant } from '../../hooks/useTenant';
import { useCountdown } from '../../hooks/useCountdown';
import { switchUserWithPin, getTeam } from '../../lib/fakeBackend';
import { toast } from '../../store/uiStore';
import Avatar from '../../components/ui/Avatar';
import PinKeypad from '../../components/staff/PinKeypad';
import Banner from '../../components/ui/Banner';
import { cx } from '../../lib/cx';

export default function SwitchUser() {
  const { business, user } = useTenant();
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]); // active staff and managers: names and colours only
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [lockedUntil, setLockedUntil] = useState(null);
  const remaining = useCountdown(lockedUntil);
  const locked = remaining > 0;

  useEffect(() => {
    getTeam().then((res) => (res.ok ? setStaff(res.team) : setError(res.error)));
  }, []);
  useEffect(() => {
    if (!locked && lockedUntil) {
      setLockedUntil(null);
      setError('');
    }
  }, [locked, lockedUntil]);

  // The server checks the PIN, counts wrong tries, and locks switching for a short time.
  const submit = async (value) => {
    const res = await switchUserWithPin(business.id, selected.id, value);
    setPin('');
    if (res.ok) {
      toast(`Switched to ${res.user.name}`);
      return navigate(res.home);
    }
    if (res.code === 'locked') setLockedUntil(Date.now() + (res.details?.secondsLeft ?? 30) * 1000);
    setError(res.code === 'locked' ? 'Too many wrong PINs.' : res.error);
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
