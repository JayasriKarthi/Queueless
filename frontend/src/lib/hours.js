const DAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const toLabel = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
};

export function todayHours(business, now = new Date()) {
  const day = business.hours?.[DAY_IDS[now.getDay()]];
  if (!day?.open) return { open: false, text: 'Closed today' };
  const mins = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = day.from.split(':').map(Number);
  const [th, tm] = day.to.split(':').map(Number);
  const within = mins >= fh * 60 + fm && mins < th * 60 + tm;
  return { open: within, text: `Today ${toLabel(day.from)} to ${toLabel(day.to)}` };
}
