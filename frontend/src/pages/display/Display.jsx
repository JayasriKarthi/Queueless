import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Volume2, Lock } from 'lucide-react';
import { useQueueStore } from '../../store/queueStore';
import { useNow } from '../../hooks/useCountdown';
import { hasFeature } from '../../config/plans';
import { waitingFor, currentFor, byQueueOrder } from '../../lib/queueMath';
import { publicUrl } from '../../lib/formatters';
import BusinessLogo from '../../components/ui/BusinessLogo';
import BigToken from '../../components/display/BigToken';
import ResourceTile from '../../components/display/ResourceTile';
import NextInLine from '../../components/display/NextInLine';

// Two soft tones made in the browser, so no audio file is needed.
function chime(ctx) {
  [660, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    const t = ctx.currentTime + i * 0.22;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.65);
  });
}

function FullMessage({ business, title, children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-10 text-center">
      <BusinessLogo business={business} size={96} />
      <p className="mt-8 text-[clamp(40px,6vw,96px)] font-medium tracking-tight">{title}</p>
      <p className="mt-4 max-w-3xl text-[clamp(18px,2vw,30px)] text-white/60">{children}</p>
    </div>
  );
}

export default function Display() {
  const { business } = useOutletContext();
  const tokens = useQueueStore((s) => s.tokens);
  const now = useNow(1000);
  const audio = useRef(null);
  const [soundAsked, setSoundAsked] = useState(false);
  const [flash, setFlash] = useState(false);
  const mine = useMemo(() => tokens.filter((t) => t.businessId === business.id), [tokens, business.id]);
  const resources = business.resources.filter((r) => r.isActive);
  const latestCall = mine.reduce((m, t) => (t.calledAt && (t.status === 'CALLED' || t.status === 'SERVING') ? Math.max(m, t.calledAt) : m), 0);
  const lastSeen = useRef(latestCall);

  useEffect(() => {
    if (latestCall > lastSeen.current) {
      setFlash(true);
      if (audio.current) chime(audio.current);
      const id = setTimeout(() => setFlash(false), 1400);
      lastSeen.current = latestCall;
      return () => clearTimeout(id);
    }
    lastSeen.current = latestCall;
    return undefined;
  }, [latestCall]);

  if (!hasFeature(business.plan, 'tvDisplay')) {
    return (
      <FullMessage business={business} title="TV display is on paid plans">
        <Lock className="mr-2 inline h-6 w-6" aria-hidden="true" />The owner of {business.name} can unlock it from Billing in the QueueLess admin.
      </FullMessage>
    );
  }
  if (!business.isLive) return <FullMessage business={business} title="Opening soon">{business.name} is getting its queue ready.</FullMessage>;

  const waitingCount = mine.filter((t) => t.status === 'WAITING').length;
  const next = mine.filter((t) => t.status === 'WAITING').sort(byQueueOrder).slice(0, 3);
  const freshId = mine.find((t) => t.calledAt === latestCall)?.resourceId;
  const single = resources.length === 1 ? resources[0] : null;

  return (
    <div className="relative flex min-h-screen flex-col p-[clamp(16px,3vw,48px)]" aria-live="polite">
      {flash && <div className="pointer-events-none absolute inset-0 z-10 animate-flash bg-[var(--brand)]" aria-hidden="true" />}
      <header className="flex items-center gap-4">
        <BusinessLogo business={business} size={64} />
        <p className="flex-1 truncate text-[clamp(22px,2.6vw,40px)] font-medium">{business.name}</p>
        <div className="text-right">
          <p className="text-[clamp(24px,3vw,48px)] font-medium tabular-nums">{new Date(now).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</p>
          <p className="text-white/50">{waitingCount} waiting</p>
        </div>
      </header>

      {!business.isOpen ? (
        <div className="flex flex-1 items-center justify-center text-center">
          <div>
            <p className="text-[clamp(64px,10vw,160px)] font-medium">Back soon</p>
            <p className="mt-4 text-2xl text-white/60">We are not taking new customers right now.</p>
          </div>
        </div>
      ) : single ? (
        <BigToken token={currentFor(mine, business.id, single.id)} resource={single} flash={flash} />
      ) : (
        <div className="mt-8 grid flex-1 auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {resources.map((r) => (
            <ResourceTile key={r.id} resource={r} token={currentFor(mine, business.id, r.id)} waiting={waitingFor(business, mine, r.id).length} highlight={flash && freshId === r.id} />
          ))}
        </div>
      )}

      <footer className="mt-8 flex items-end justify-between gap-6">
        <NextInLine tokens={next} />
        <div className="flex shrink-0 items-center gap-4 rounded-3xl bg-white/[.06] p-4">
          <div className="text-right">
            <p className="text-xl font-medium">Scan to join</p>
            <p className="text-sm text-white/50">No app needed</p>
          </div>
          <div className="rounded-xl bg-white p-2">
            <QRCodeSVG value={publicUrl(`/${business.slug}`)} size={112} />
          </div>
        </div>
      </footer>

      {!soundAsked && (
        <button
          type="button"
          onClick={() => {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) {
              audio.current = new Ctx();
              chime(audio.current);
            }
            setSoundAsked(true);
            document.documentElement.requestFullscreen?.().catch(() => {});
          }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/75 text-white backdrop-blur-sm"
        >
          <Volume2 className="h-16 w-16" aria-hidden="true" />
          <span className="text-3xl font-medium">Click to enable sound</span>
          <span className="text-white/60">A chime plays each time a new token is called</span>
        </button>
      )}
    </div>
  );
}
