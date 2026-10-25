import { Home, ListOrdered, Layers, Users, UserRound, BarChart3, UserCog, Radio, CreditCard, Settings } from 'lucide-react';

// One source for the admin sidebar and the command palette.
export function adminNav(labels) {
  return [
    { to: '/admin', label: 'Home', icon: Home, end: true, group: 'main' },
    { to: '/admin/queues', label: 'Queues', icon: ListOrdered, badge: 'waiting', group: 'main' },
    { to: '/admin/services', label: 'Services', icon: Layers, group: 'main' },
    { to: '/admin/resources', label: labels?.resourcePlural ?? 'Counters', icon: UserRound, group: 'main' },
    { to: '/admin/customers', label: 'Customers', icon: Users, group: 'main' },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, group: 'main' },
    { to: '/admin/staff', label: 'Staff', icon: UserCog, group: 'main' },
    { to: '/admin/channels', label: 'Channels', icon: Radio, group: 'channels' },
    { to: '/admin/billing', label: 'Billing', icon: CreditCard, group: 'bottom' },
    { to: '/admin/settings', label: 'Settings', icon: Settings, group: 'bottom' },
  ];
}
