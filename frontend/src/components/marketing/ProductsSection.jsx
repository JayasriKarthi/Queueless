import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Reveal from './Reveal';
import StructureDiagrams from './StructureDiagrams';
import { LinkMockup, ConsoleMockup, TvProductMockup, AlertsMockup, AnalyticsMockup } from './ProductMockups';
import { cx } from '../../lib/cx';

const ROWS = [
  { id: 'product-link', eyebrow: 'Customer link and QR', title: 'One scan and they are in line', text: 'Print your QR poster or share the link. Customers enter their name and number, pick a service, and get a token with a live position. No app, no account.', Mock: LinkMockup },
  { id: 'product-console', eyebrow: 'Staff console', title: 'Call the next person with one tap', text: 'Staff see who is next, call, recall, mark no-shows, and add walk-ins. Keyboard shortcuts keep busy desks quick, and PIN switching suits shared computers.', Mock: ConsoleMockup },
  { id: 'product-tv', eyebrow: 'Waiting-room TV display', title: 'A screen everyone can read from the back', text: 'Open the display link on any smart TV. It shows who is being served, who is next, and a QR code so new arrivals can join.', Mock: TvProductMockup },
  { id: 'product-alerts', eyebrow: 'Smart alerts', title: 'Bring people back right on time', text: 'Customers get a browser alert and vibration when only a few people are ahead. SMS alerts are available on paid plans.', Mock: AlertsMockup },
  { id: 'product-analytics', eyebrow: 'Analytics', title: 'Know your busy hours before they happen', text: 'Track daily volume, waits by hour, no-shows, and how each counter or doctor is doing. Export to CSV on Business plans.', Mock: AnalyticsMockup },
];

export default function ProductsSection() {
  return (
    <section id="products" className="bg-white">
      <div className="mk-container mk-section">
        <Reveal className="max-w-4xl">
          <p className="mk-eyebrow">Products</p>
          <h2 className="mt-4 text-display-sm font-normal">Everything you need to run a calm, fair line.</h2>
        </Reveal>
        <div className="mt-20 space-y-24 md:space-y-32">
          {ROWS.map((row, i) => (
            <div key={row.id} id={row.id} className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
              <Reveal className={cx(i % 2 && 'md:order-2')}>
                <p className="mk-eyebrow">{row.eyebrow}</p>
                <h3 className="mt-3 text-[clamp(28px,3.6vw,44px)] leading-[1.08] tracking-[-0.03em]">{row.title}</h3>
                <p className="mt-4 text-lg leading-relaxed text-black/65">{row.text}</p>
                <Link to="/signup" className="mt-6 inline-flex items-center gap-1.5 font-medium text-teal-700 hover:underline">
                  Start free <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Reveal>
              <Reveal delay={120} className={cx('rounded-[32px] bg-cream p-4 sm:p-8', i % 2 && 'md:order-1')}>
                <row.Mock />
              </Reveal>
            </div>
          ))}
        </div>
        <StructureDiagrams />
      </div>
    </section>
  );
}
