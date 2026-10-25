import { Clock } from 'lucide-react';
import BusinessLogo from '../ui/BusinessLogo';
import { todayHours } from '../../lib/hours';

export default function BusinessHeader({ business, showWelcome = true, live }) {
  const hours = todayHours(business);
  const accepting = business.isLive && business.isOpen;
  return (
    <header>
      <div className="flex items-center gap-3">
        <BusinessLogo business={business} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-medium tracking-tight">{business.name}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className={`inline-flex items-center gap-1.5 font-medium ${accepting ? 'text-[#1F7A4C] dark:text-emerald-400' : 'text-[#B42318] dark:text-red-400'}`}>
              <span className={`h-2 w-2 rounded-full ${accepting ? 'bg-[#1F7A4C]' : 'bg-[#B42318]'}`} aria-hidden="true" />
              {accepting ? 'Open' : 'Closed'}
            </span>
            <span className="inline-flex items-center gap-1 text-black/55 dark:text-white/55">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {hours.text}
            </span>
          </div>
        </div>
        {live && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1F7A4C] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#1F7A4C]" /></span>
            Live
          </span>
        )}
      </div>
      {showWelcome && business.branding.welcomeMessage && <p className="mt-4 text-[15px] leading-relaxed text-black/70 dark:text-white/70">{business.branding.welcomeMessage}</p>}
    </header>
  );
}
