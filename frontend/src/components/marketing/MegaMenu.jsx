import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cx } from '../../lib/cx';

export default function MegaMenu({ id, items, onNavigate }) {
  const wide = items.length > 4;
  return (
    <div id={id} className="absolute inset-x-0 top-full border-t border-black/5 bg-white shadow-[0_24px_48px_-16px_rgba(11,31,28,.18)] animate-pop">
      <div className="mk-container grid gap-8 py-8 lg:grid-cols-[1fr_280px]">
        <ul className={cx('grid gap-2 sm:grid-cols-2', wide && 'lg:grid-cols-3')}>
          {items.map((item) => (
            <li key={item.title}>
              <Link to={item.to} onClick={onNavigate} className="group flex gap-3 rounded-2xl p-3 transition hover:bg-cream">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[15px] font-medium text-ink">{item.title}</span>
                  <span className="block text-sm text-black/60">{item.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden rounded-2xl bg-ink p-5 text-white lg:block">
          <p className="text-sm text-white/60">New</p>
          <p className="mt-1 text-lg leading-snug">Print a branded QR poster in one click.</p>
          <Link to="/signup" onClick={onNavigate} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#5FD3C4] hover:underline">
            Try it free <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
