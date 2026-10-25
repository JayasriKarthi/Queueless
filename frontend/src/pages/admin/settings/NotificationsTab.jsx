import { hasFeature } from '../../../config/plans';
import Toggle from '../../../components/ui/Toggle';
import { LockBadge } from '../../../components/ui/LockedFeature';

export default function NotificationsTab({ business, draft, update }) {
  const n = draft.notifications;
  const set = (key) => (v) => update({ notifications: { ...n, [key]: v } });
  const sms = hasFeature(business.plan, 'smsAlerts');
  return (
    <div className="max-w-xl space-y-5">
      <h3 className="text-sm font-medium">Customer alerts</h3>
      <Toggle label="Browser alert when almost their turn" help="Customers who allow notifications get an alert and vibration when 3 or fewer people are ahead." checked={n.almostBrowser} onChange={set('almostBrowser')} />
      <div className="flex items-start gap-3">
        <Toggle className="flex-1" label="SMS when almost their turn" help={sms ? `Uses SMS credits. ${business.smsUsed} used this month.` : 'Reach people who closed the page. Available on paid plans.'} checked={sms && n.almostSms} disabled={!sms} onChange={set('almostSms')} />
        {!sms && <LockBadge plan="Pro" />}
      </div>
      <h3 className="border-t border-admin-border pt-5 text-sm font-medium dark:border-neutral-800">For you</h3>
      <Toggle label="Daily summary" help="A short recap of tokens, waits, and no-shows in your notifications." checked={n.dailySummary} onChange={set('dailySummary')} />
      <Toggle label="When staff accept an invite" checked={n.staffJoins} onChange={set('staffJoins')} />
    </div>
  );
}
