import { cx } from '../../lib/cx';

export default function ResourceTile({ resource, token, waiting, highlight }) {
  return (
    <div className={cx('flex flex-col justify-between rounded-3xl border p-6 transition-colors duration-700', highlight ? 'border-[var(--brand)] bg-[var(--brand-soft)]' : 'border-white/10 bg-white/[.04]')}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[clamp(18px,2vw,28px)] text-white/80">{resource.name}</p>
        {resource.isPaused && <span className="rounded-full bg-white/10 px-3 py-1 text-sm">Paused</span>}
      </div>
      <p className="mt-4 text-[clamp(56px,8vw,120px)] font-medium leading-none tracking-[-0.03em] text-[var(--brand)]" style={{ filter: 'brightness(1.3)' }}>{token?.code ?? '–'}</p>
      <p className="mt-3 text-lg text-white/50">{waiting} waiting</p>
    </div>
  );
}
