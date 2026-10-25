import { QrCode, MonitorSmartphone, Tv, BellRing, BarChart3, Stethoscope, Landmark, Scissors, UtensilsCrossed, Building2, Ticket, BookOpen, LifeBuoy, FileText, Code2 } from 'lucide-react';

export const PRODUCT_ITEMS = [
  { icon: QrCode, title: 'Customer link and QR', text: 'Customers join from their phone in seconds.', to: '/#product-link' },
  { icon: MonitorSmartphone, title: 'Staff console', text: 'Call, recall, and finish tokens with one tap.', to: '/#product-console' },
  { icon: Tv, title: 'Waiting-room TV display', text: 'A big, clear "now serving" screen.', to: '/#product-tv' },
  { icon: BellRing, title: 'Smart alerts', text: 'Nudge people when their turn is near.', to: '/#product-alerts' },
  { icon: BarChart3, title: 'Analytics', text: 'See busy hours, waits, and no-shows.', to: '/#product-analytics' },
];

export const SOLUTION_ITEMS = [
  { icon: Stethoscope, title: 'Clinics', text: 'One line per doctor, priority for seniors.', to: '/signup?type=clinic' },
  { icon: Landmark, title: 'Banks', text: 'One line per service across counters.', to: '/signup?type=bank' },
  { icon: Scissors, title: 'Salons', text: 'Pick a stylist or the next one free.', to: '/signup?type=salon' },
  { icon: UtensilsCrossed, title: 'Canteens', text: 'One shared line for fast pickups.', to: '/signup?type=canteen' },
  { icon: Building2, title: 'Government offices', text: 'Calm, fair desks for public services.', to: '/signup?type=office' },
  { icon: Ticket, title: 'Events', text: 'Entry gates and help desks that flow.', to: '/signup?type=event' },
];

export const RESOURCE_ITEMS = [
  { icon: BookOpen, title: 'Setup guide', text: 'Go live in five minutes.', to: '/#why' },
  { icon: LifeBuoy, title: 'Help centre', text: 'Answers to common questions.', to: '/#faq' },
  { icon: FileText, title: 'Poster templates', text: 'Print-ready QR posters.', to: '/#product-link' },
  { icon: Code2, title: 'API and integrations', text: 'For Business and Enterprise.', to: '/enterprise' },
];

export const NAV_ITEMS = [
  { id: 'products', label: 'Products', items: PRODUCT_ITEMS },
  { id: 'solutions', label: 'Solutions', items: SOLUTION_ITEMS },
  { id: 'pricing', label: 'Pricing', to: '/pricing' },
  { id: 'resources', label: 'Resources', items: RESOURCE_ITEMS },
  { id: 'enterprise', label: 'Enterprise', to: '/enterprise' },
];
