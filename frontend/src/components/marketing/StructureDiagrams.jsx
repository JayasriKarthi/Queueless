import Reveal from './Reveal';

function Person({ fill = '#0E9F8E' }) {
  return <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ background: fill }} />;
}

function Line({ count, label, color }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">{Array.from({ length: count }, (_, i) => <Person key={i} fill={color} />)}</div>
      <span className="h-px flex-1 bg-black/15" />
      <span className="whitespace-nowrap rounded-full bg-white px-3 py-1 text-sm shadow-card">{label}</span>
    </div>
  );
}

const CARDS = [
  { title: 'Clinic', sub: 'One line per doctor', lines: [[4, 'Dr. Rao'], [2, 'Dr. Menon'], [3, 'Dr. Siddiqui']], color: '#2563EB' },
  { title: 'Bank', sub: 'One line per service', lines: [[5, 'Cash'], [2, 'Accounts'], [1, 'Loans']], color: '#7C3AED' },
  { title: 'Canteen', sub: 'One shared line', lines: [[7, 'Next free counter']], color: '#EA580C' },
];

export default function StructureDiagrams() {
  return (
    <div className="mt-28">
      <Reveal className="max-w-2xl">
        <h3 className="text-[clamp(28px,4vw,48px)] leading-tight tracking-[-0.03em]">Works for your structure</h3>
        <p className="mt-3 text-lg text-black/65">Pick a queue mode that matches how you serve people. You can change it later.</p>
      </Reveal>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {CARDS.map((c, i) => (
          <Reveal key={c.title} delay={i * 100} className="rounded-xl2 bg-cream p-6">
            <p className="text-xl font-medium">{c.title}</p>
            <p className="text-black/60">{c.sub}</p>
            <div className="mt-6 space-y-3" role="img" aria-label={`${c.title}: ${c.sub}`}>
              {c.lines.map(([n, label]) => <Line key={label} count={n} label={label} color={c.color} />)}
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
