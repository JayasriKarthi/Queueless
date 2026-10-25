export default function NextInLine({ tokens }) {
  return (
    <div>
      <p className="text-sm uppercase tracking-[.3em] text-white/50">Next in line</p>
      {tokens.length === 0 ? (
        <p className="mt-3 text-2xl text-white/40">No one waiting</p>
      ) : (
        <ol className="mt-3 flex flex-wrap gap-3">
          {tokens.map((t) => (
            <li key={t.id} className="rounded-2xl bg-white/[.06] px-5 py-3 text-[clamp(24px,3vw,44px)] font-medium tabular-nums">{t.code}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
