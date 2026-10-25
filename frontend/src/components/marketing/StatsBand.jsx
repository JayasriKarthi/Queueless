import Reveal from './Reveal';

// Sample numbers for the marketing page, not measured results.
const STATS = [
  { value: '10 sec', label: 'to join a line from a QR code' },
  { value: '0', label: 'downloads for your customers' },
  { value: '3', label: 'queue modes for any business structure' },
  { value: '5 min', label: 'to set up and go live' },
];

export default function StatsBand() {
  return (
    <section className="bg-ink text-white">
      <div className="mk-container mk-section">
        <Reveal className="max-w-3xl">
          <h2 className="text-display-sm font-normal">Built to be the fastest line in town.</h2>
        </Reveal>
        <dl className="mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 80} className="border-t border-white/15 pt-6">
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <span className="block text-[clamp(48px,6vw,80px)] font-light leading-none tracking-[-0.04em] text-[#5FD3C4]">{s.value}</span>
                <span className="mt-3 block text-lg text-white/70">{s.label}</span>
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
