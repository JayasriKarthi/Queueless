import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { CheckCircle2, Star, UserX, XCircle, SearchX, Bell } from 'lucide-react';
import { useQueueStore } from '../../store/queueStore';
import { useGuestToken } from '../../hooks/useGuestToken';
import { useCountdown } from '../../hooks/useCountdown';
import { leaveQueue, rateToken } from '../../lib/fakeBackend';
import { aheadOf, estimateWait, byQueueOrder } from '../../lib/queueMath';
import { formatDuration } from '../../lib/formatters';
import { ALMOST_THRESHOLD, NO_SHOW_MINUTES } from '../../config/constants';
import BusinessHeader from '../../components/customer/BusinessHeader';
import TokenCard from '../../components/customer/TokenCard';
import PositionStats from '../../components/customer/PositionStats';
import AlertBanner from '../../components/customer/AlertBanner';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { customerCard } from '../../components/customer/styles';
import { cx } from '../../lib/cx';

const notifiedKey = (id, stage) => `ql-notified:${id}:${stage}`;

// One-time browser notification plus vibration, only if permission was granted.
function alertOnce(token, stage, title, body) {
  try {
    if (localStorage.getItem(notifiedKey(token.id, stage))) return;
    localStorage.setItem(notifiedKey(token.id, stage), '1');
  } catch {
    /* ignore */
  }
  navigator.vibrate?.([200, 100, 200]);
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: `${token.id}-${stage}` });
    } catch {
      /* some mobile browsers only allow notifications from a service worker */
    }
  }
}

function Rating({ token }) {
  const [hover, setHover] = useState(0);
  const value = token.rating ?? 0;
  return (
    <div className="mt-4">
      <p className="text-sm opacity-80">{value ? 'Thanks for your rating' : 'How was your visit?'}</p>
      <div className="mt-2 flex justify-center gap-1" role="radiogroup" aria-label="Rate your visit">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => rateToken(token.id, n)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/15">
            <Star className={cx('h-7 w-7', (hover || value) >= n ? 'fill-current' : 'opacity-50')} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

function EndState({ icon: Icon, title, children, business, onJoinAgain, tone = 'muted', token }) {
  return (
    <TokenCard code={token.code} label={title} tone={tone}>
      <Icon className="mx-auto mt-4 h-8 w-8" aria-hidden="true" />
      <p className="mt-2 text-sm opacity-85">{children}</p>
      {token.status === 'DONE' && <Rating token={token} />}
      <Button variant={tone === 'success' ? 'pillLight' : 'brand'} size="lg" className="mt-5" onClick={onJoinAgain}>Join again</Button>
      <p className="mt-3 text-xs opacity-60">{business.name}</p>
    </TokenCard>
  );
}

export default function TokenStatus() {
  const { business } = useOutletContext();
  const { tokenId } = useParams();
  const navigate = useNavigate();
  const tokens = useQueueStore((s) => s.tokens);
  const [, setGuestTokenId] = useGuestToken(business.slug);
  const [leaving, setLeaving] = useState(false);
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const token = tokens.find((t) => t.id === tokenId && t.businessId === business.id);
  const noShowMinutes = business.settings.noShowMinutes ?? NO_SHOW_MINUTES;
  const remaining = useCountdown(token?.status === 'CALLED' ? token.calledAt + noShowMinutes * 60000 : null);

  const info = useMemo(() => {
    if (!token) return null;
    const ahead = aheadOf(tokens, token);
    const line = tokens.filter((t) => t.businessId === business.id && t.queueKey === token.queueKey);
    const servedBefore = line.filter((t) => t.status !== 'WAITING' && t.createdAt >= token.createdAt - 4 * 3600000 && t.createdAt < token.createdAt).length;
    const current = line.filter((t) => t.status === 'CALLED' || t.status === 'SERVING').sort((a, b) => b.calledAt - a.calledAt)[0];
    return {
      ahead,
      minutes: estimateWait(business, ahead, token.serviceId, token.queueKey),
      progress: Math.round(((servedBefore + 1) / (servedBefore + ahead + 1)) * 100),
      nowServing: current?.code,
      next: line.filter((t) => t.status === 'WAITING').sort(byQueueOrder)[0],
    };
  }, [token, tokens, business]);

  const almost = token?.status === 'WAITING' && info.ahead <= ALMOST_THRESHOLD;
  const lastStatus = useRef(token?.status);
  useEffect(() => {
    if (!token) return;
    if (almost) alertOnce(token, 'almost', `Almost your turn at ${business.name}`, `${info.ahead === 0 ? 'You are next' : `${info.ahead} ahead of you`}. Please head back.`);
    if (token.status === 'CALLED' && lastStatus.current !== 'CALLED') alertOnce(token, `called-${token.recalls}`, 'It is your turn', `Token ${token.code}, please go now.`);
    lastStatus.current = token.status;
  }, [token, almost, info, business.name]);

  if (!token) {
    return (
      <div>
        <BusinessHeader business={business} showWelcome={false} />
        <div className={`${customerCard} mt-6 text-center`}>
          <SearchX className="mx-auto h-10 w-10 text-black/40" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-medium">Token not found</h2>
          <p className="mt-2 text-black/60 dark:text-white/60">This token link is not valid for {business.name}. It may be from another day or another business.</p>
          <Button variant="brand" size="lg" className="mt-5" to={`/${business.slug}`}>Join the line</Button>
        </div>
      </div>
    );
  }

  const resource = business.resources.find((r) => r.id === token.resourceId);
  const service = business.services.find((s) => s.id === token.serviceId);
  const joinAgain = () => {
    setGuestTokenId(null);
    navigate(`/${business.slug}`);
  };
  const enableAlerts = async () => {
    if (!('Notification' in window)) return;
    setPerm(await Notification.requestPermission());
  };

  const enableButton = perm === 'default' && (
    <Button size="sm" variant="brandOutline" icon={Bell} onClick={enableAlerts}>Enable alerts</Button>
  );

  return (
    <div className="space-y-4">
      <BusinessHeader business={business} showWelcome={false} live />
      <div aria-live="polite" aria-atomic="true" className="space-y-4">
        {token.status === 'WAITING' && (
          <>
            {almost && <AlertBanner title={info.ahead === 0 ? 'You are next' : 'Almost your turn'} action={enableButton}>Only {info.ahead} {info.ahead === 1 ? 'person is' : 'people are'} ahead. Please head back now.</AlertBanner>}
            <TokenCard code={token.code}>
              <p className="mt-2 text-sm text-black/55 dark:text-white/55">{service?.name}{resource && business.settings.queueMode === 'per_resource' ? ` with ${resource.name}` : ''}{token.priority ? ' · Priority' : ''}</p>
            </TokenCard>
            <PositionStats ahead={info.ahead} minutes={info.minutes} progress={info.progress} nowServing={info.nowServing} />
            {!almost && perm === 'default' && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 text-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
                <span>Get an alert on this phone when you are close.</span>
                {enableButton}
              </div>
            )}
            {perm === 'granted' && <p className="text-center text-sm text-black/55 dark:text-white/55">Alerts are on. Keep this page open in your browser.</p>}
            <Button variant="ghost" size="lg" className="w-full !text-[#B42318] dark:!text-red-400" onClick={() => setLeaving(true)}>Leave queue</Button>
          </>
        )}

        {token.status === 'CALLED' && (
          <TokenCard code={token.code} label="It is your turn" tone="success" pulse>
            <p className="mt-3 text-lg">Please go to {resource?.name ?? 'the counter'}</p>
            <p className="mt-4 text-sm text-white/80">Please arrive within</p>
            <p className="text-3xl font-medium tabular-nums" aria-label={`${Math.ceil(remaining / 60000)} minutes left`}>{formatDuration(remaining)}</p>
            {remaining === 0 && <p className="mt-1 text-sm">Time is up. Please hurry, staff may mark you as a no-show.</p>}
          </TokenCard>
        )}

        {token.status === 'SERVING' && (
          <TokenCard code={token.code} label="You are being served" tone="brand">
            <p className="mt-3">at {resource?.name ?? 'the counter'}</p>
          </TokenCard>
        )}

        {token.status === 'DONE' && <EndState icon={CheckCircle2} title="Thank you for visiting" tone="success" token={token} business={business} onJoinAgain={joinAgain}>We hope to see you again.</EndState>}
        {token.status === 'NO_SHOW' && <EndState icon={UserX} title="You missed your turn" token={token} business={business} onJoinAgain={joinAgain}>You were called but did not arrive in time. You can join the line again.</EndState>}
        {token.status === 'CANCELLED' && <EndState icon={XCircle} title={token.cancelledBy === 'customer' ? 'You left the line' : 'Your token was cancelled'} token={token} business={business} onJoinAgain={joinAgain}>{token.cancelledBy === 'customer' ? 'Your spot has been given to the next person.' : 'Staff removed this token. Please ask at the front desk if this is a mistake.'}</EndState>}
      </div>
      <p className="text-center text-xs text-black/45 dark:text-white/45">
        Keep this page open. It updates by itself. <Link to={`/${business.slug}`} className="underline">Back to {business.name}</Link>
      </p>
      <ConfirmDialog
        open={leaving}
        onClose={() => setLeaving(false)}
        title="Leave the queue?"
        message={`You will lose your place (${token.code}). You can join again, but you will go to the end of the line.`}
        confirmLabel="Leave queue"
        onConfirm={() => {
          leaveQueue(token.id);
          setLeaving(false);
        }}
      />
    </div>
  );
}
