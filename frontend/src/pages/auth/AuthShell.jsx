import { Check } from 'lucide-react';
import Logo from '../../components/ui/Logo';

const POINTS = ['Customers join from their phone, no app', 'Live position and wait estimate', 'Staff console and TV display', 'Customise everything on the Free plan'];

// Split layout: form on the left, teal value panel on the right (hidden on mobile).
export default function AuthShell({ children, panelTitle = 'Your queue, live in five minutes.' }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(420px,44%)]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">{children}</div>
      </div>
      <aside className="relative hidden overflow-hidden bg-teal-700 p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" aria-hidden="true" />
        <div className="absolute right-20 top-40 h-40 w-40 rounded-full bg-white/10" aria-hidden="true" />
        <div className="relative">
          <p className="text-[44px] font-normal leading-[1.05] tracking-[-0.03em]">{panelTitle}</p>
          <ul className="mt-8 space-y-3 text-lg text-white/90">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
