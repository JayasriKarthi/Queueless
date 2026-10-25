import { Stethoscope, Landmark, Scissors, UtensilsCrossed, Building2, Ticket } from 'lucide-react';

const ITEMS = [
  [Stethoscope, 'Clinics'],
  [Landmark, 'Banks'],
  [Scissors, 'Salons'],
  [UtensilsCrossed, 'Canteens'],
  [Building2, 'Government offices'],
  [Ticket, 'Events'],
];

export default function BuiltForStrip() {
  return (
    <section aria-label="Built for" className="border-y border-black/5 bg-white py-10">
      <div className="mk-container">
        <p className="text-center text-sm text-black/55">Built for every place people wait</p>
        <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          {ITEMS.map(([Icon, label]) => (
            <li key={label} className="flex items-center justify-center gap-2 text-lg text-black/70">
              <Icon className="h-5 w-5 text-teal" aria-hidden="true" /> {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
