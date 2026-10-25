import { Link } from 'react-router-dom';
import Logo from '../ui/Logo';

const COLUMNS = [
  { title: 'Product', links: [['Customer link and QR', '/#product-link'], ['Staff console', '/#product-console'], ['TV display', '/#product-tv'], ['Smart alerts', '/#product-alerts'], ['Analytics', '/#product-analytics']] },
  { title: 'Solutions', links: [['Clinics', '/signup?type=clinic'], ['Banks', '/signup?type=bank'], ['Salons', '/signup?type=salon'], ['Canteens', '/signup?type=canteen'], ['Events', '/signup?type=event']] },
  { title: 'Company', links: [['Pricing', '/pricing'], ['Enterprise', '/enterprise'], ['Contact sales', '/contact-sales'], ['FAQ', '/#faq']] },
  { title: 'Try it', links: [['Live demo: clinic', '/city-care'], ['Live demo: bank', '/united-bank'], ['TV display demo', '/display/united-bank'], ['Log in', '/login']] },
];

export default function Footer() {
  return (
    <footer className="bg-[#050F0D] text-white/70">
      <div className="mk-container py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs text-sm">Virtual queues for clinics, banks, salons, canteens, offices, and events.</p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-sm font-medium text-white">{col.title}</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map(([label, to]) => (
                  <li key={label}>
                    <Link to={to} className="hover:text-white">{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-14 flex flex-col justify-between gap-3 border-t border-white/10 pt-6 text-xs sm:flex-row">
          <p>© {new Date().getFullYear()} QueueLess. A demo product.</p>
          <p>Made for places where people wait.</p>
        </div>
      </div>
    </footer>
  );
}
