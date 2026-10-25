import { X, Check, QrCode, Ticket, BellRing, Zap, Smartphone, Network, CalendarCheck, Crown, LineChart } from 'lucide-react';
import Reveal from './Reveal';

const PROBLEMS = ['Long physical lines out the door', 'Crowded, stressful waiting rooms', 'No idea how long the wait will be', 'People walk away and do not come back'];
const SOLUTIONS = ['Customers wait wherever they like', 'Calm rooms with only the next few people', 'A live position and wait estimate on every phone', 'Alerts bring people back right on time'];

const STEPS = [
  { icon: QrCode, title: 'Scan the QR', text: 'Customers scan your poster or open your link. No app and no sign-up.' },
  { icon: Ticket, title: 'Get a token', text: 'They pick a service or person and get a token with a live position.' },
  { icon: BellRing, title: 'Get alerted', text: 'When a few people are left, their phone nudges them to come back.' },
];

const BENEFITS = [
  { icon: Zap, title: 'Real-time updates', text: 'Every phone, console, and screen updates the moment staff call the next token.' },
  { icon: Smartphone, title: 'No app or account', text: 'Customers join from any browser. Nothing to download, nothing to remember.' },
  { icon: Network, title: 'Fits any structure', text: 'One line per doctor, one per service, or one shared line. Switch any time.' },
  { icon: CalendarCheck, title: 'Fewer no-shows', text: 'Timely alerts and a short grace period keep the line moving.' },
  { icon: Crown, title: 'Priority queues', text: 'Let seniors, pregnant women, or members move ahead fairly.' },
  { icon: LineChart, title: 'Analytics', text: 'See busy hours, average waits, and which counters need help.' },
];

export default function WhySection() {
  return (
    <section id="why" className="bg-cream">
      <div className="mk-container mk-section">
        <Reveal className="max-w-5xl">
          <p className="mk-eyebrow">Why QueueLess</p>
          <h2 className="mt-4 text-display-sm font-normal">Waiting is part of the visit. Standing in line does not have to be.</h2>
        </Reveal>

        <div className="mt-16 grid gap-4 md:grid-cols-2">
          <Reveal className="rounded-xl2 bg-white p-8 md:p-10">
            <p className="text-sm font-medium text-black/50">Without a virtual queue</p>
            <ul className="mt-6 space-y-4">
              {PROBLEMS.map((p) => (
                <li key={p} className="flex gap-3 text-lg">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FEE9E8] text-[#8E0B21]">
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={100} className="rounded-xl2 bg-ink p-8 text-white md:p-10">
            <p className="text-sm font-medium text-[#5FD3C4]">With QueueLess</p>
            <ul className="mt-6 space-y-4">
              {SOLUTIONS.map((s) => (
                <li key={s} className="flex gap-3 text-lg">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal text-white">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <div className="mt-28">
          <Reveal>
            <h3 className="text-[clamp(28px,4vw,48px)] leading-tight tracking-[-0.03em]">How it works</h3>
          </Reveal>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 100} className="rounded-xl2 bg-white p-8">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                    <s.icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="text-5xl font-light text-black/10">{i + 1}</span>
                </div>
                <p className="mt-8 text-xl font-medium">{s.title}</p>
                <p className="mt-2 text-[17px] leading-relaxed text-black/65">{s.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>

        <div className="mt-28 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={(i % 3) * 80}>
              <b.icon className="h-7 w-7 text-teal" aria-hidden="true" />
              <p className="mt-4 text-xl font-medium">{b.title}</p>
              <p className="mt-2 text-[17px] leading-relaxed text-black/65">{b.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
