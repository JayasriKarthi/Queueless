export default function BigToken({ token, resource, flash }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="text-[clamp(18px,2.4vw,32px)] uppercase tracking-[.3em] text-white/50">Now serving</p>
      <p key={token?.id ?? 'none'} className={`mt-4 text-[clamp(96px,22vw,300px)] font-medium leading-none tracking-[-0.04em] text-[var(--brand)] ${flash ? 'animate-pulse' : ''}`} style={{ filter: 'brightness(1.3)' }}>
        {token?.code ?? '–'}
      </p>
      <p className="mt-6 text-[clamp(20px,3vw,44px)] text-white/80">{token ? `Please go to ${resource.name}` : 'Waiting for the next customer'}</p>
    </div>
  );
}
