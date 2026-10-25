import { Check } from 'lucide-react';
import Button from '../ui/Button';
import Reveal from './Reveal';

const POINTS = ['Multi-location management', 'SSO and custom roles', 'Audit logs', 'API and integrations', 'Dedicated onboarding', 'Uptime SLA', 'Data residency options'];

export default function EnterpriseSection() {
  return (
    <section id="enterprise" className="bg-ink text-white">
      <div className="mk-container mk-section grid gap-12 md:grid-cols-[1.2fr_1fr] md:items-end">
        <Reveal>
          <p className="text-sm font-medium text-[#5FD3C4]">Enterprise</p>
          <h2 className="mt-4 text-display-sm font-normal">QueueLess for large organisations</h2>
          <p className="mt-6 max-w-xl text-lg text-white/70">Hospital groups, bank networks, and public services run hundreds of lines across cities. We help you roll out with confidence.</p>
          <Button variant="pillLight" size="xl" to="/contact-sales" className="mt-8">
            Contact sales
          </Button>
        </Reveal>
        <Reveal delay={120} as="ul" className="space-y-4">
          {POINTS.map((p) => (
            <li key={p} className="flex items-center gap-3 border-b border-white/10 pb-4 text-lg">
              <Check className="h-5 w-5 text-[#5FD3C4]" aria-hidden="true" /> {p}
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
