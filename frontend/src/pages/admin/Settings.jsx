import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTenant, useTenantTokens } from '../../hooks/useTenant';
import { saveSettings, updateBranding, getBusiness } from '../../lib/fakeBackend';
import { isActive } from '../../lib/queueMath';
import { QUEUE_MODES } from '../../config/constants';
import { toast } from '../../store/uiStore';
import PageHeader from '../../components/ui/PageHeader';
import Tabs from '../../components/ui/Tabs';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import BusinessTab from './settings/BusinessTab';
import QueueRulesTab from './settings/QueueRulesTab';
import JoinFormTab from './settings/JoinFormTab';
import HoursTab from './settings/HoursTab';
import BrandingTab from './settings/BrandingTab';
import NotificationsTab from './settings/NotificationsTab';
import DangerZoneTab from './settings/DangerZoneTab';

const TABS = [
  { id: 'business', label: 'Business', Comp: BusinessTab },
  { id: 'rules', label: 'Queue rules', Comp: QueueRulesTab },
  { id: 'form', label: 'Customer join form', Comp: JoinFormTab },
  { id: 'hours', label: 'Hours', Comp: HoursTab },
  { id: 'branding', label: 'Branding', Comp: BrandingTab },
  { id: 'notifications', label: 'Notifications', Comp: NotificationsTab },
  { id: 'danger', label: 'Danger zone', Comp: DangerZoneTab },
];

const pickDraft = (b) => ({ name: b.name, type: b.type, contact: b.contact, labels: b.labels, settings: b.settings, hours: b.hours, branding: b.branding, notifications: b.notifications });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function Settings() {
  const { business } = useTenant();
  const tokens = useTenantTokens();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'business';
  const original = useMemo(() => pickDraft(business), [business]);
  const [draft, setDraft] = useState(original);
  const [modeWarn, setModeWarn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);
  const dirty = !same(draft, original);

  // Pick up changes saved elsewhere (another screen, live updates) when nothing is being edited.
  useEffect(() => {
    if (!dirty) setDraft(original);
  }, [original]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const activeTokens = tokens.filter(isActive).length;

  // Sends only the groups that changed. The server records setup progress (join form, hours).
  const commit = async (confirm = false) => {
    const { branding, ...rest } = draft;
    const changed = Object.fromEntries(Object.entries(rest).filter(([key, value]) => !same(value, original[key])));
    setSaving(true);
    try {
      if (Object.keys(changed).length) {
        const res = await saveSettings(business.id, changed, { confirm });
        if (!res.ok && res.code === 'ACTIVE_TOKENS') {
          setWaitingCount(res.details?.count ?? activeTokens);
          return setModeWarn(true);
        }
        if (!res.ok) return toast(res.details?.[0]?.message ?? res.error, { tone: 'critical' });
      }
      if (!same(branding, original.branding)) {
        const res = await updateBranding(business.id, branding);
        if (!res.ok) return toast(res.error, { tone: 'critical' });
      }
      setModeWarn(false);
      setDraft(pickDraft(getBusiness(business.id))); // what the server saved
      toast('Settings saved');
    } finally {
      setSaving(false);
    }
  };
  const save = () => {
    if (!draft.name.trim()) return toast('Business name cannot be empty', { tone: 'critical' });
    commit();
  };

  const Current = TABS.find((t) => t.id === tab).Comp;

  return (
    <div className="pb-20">
      <PageHeader title="Settings" subtitle="Everything here is free to change on every plan" />
      <div className="ql-card overflow-hidden">
        <Tabs className="px-2" value={tab} onChange={(id) => setParams({ tab: id }, { replace: true })} tabs={TABS} />
        <div role="tabpanel" aria-labelledby={`tab-${tab}`} className="p-4">
          <Current business={business} draft={draft} update={update} />
        </div>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#1A1A1A] px-4 py-3 text-white animate-fade-up" role="region" aria-label="Unsaved changes">
          <div className="mx-auto flex max-w-admin items-center justify-between gap-3">
            <p className="text-[13px] font-medium">Unsaved changes</p>
            <div className="flex gap-2">
              <Button size="sm" className="!border-white/20 !bg-transparent !text-white hover:!bg-white/10" onClick={() => setDraft(original)}>Discard</Button>
              <Button size="sm" variant="pillLight" className="!rounded-lg" loading={saving} onClick={save}>Save</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={modeWarn}
        onClose={() => setModeWarn(false)}
        onConfirm={() => commit(true)}
        tone="primary"
        title="Change queue mode while people are waiting?"
        message={`${waitingCount} token${waitingCount === 1 ? ' is' : 's are'} active right now. They stay in their current line, but new customers will join using "${QUEUE_MODES[draft.settings.queueMode].label}". Waiting estimates may jump for a while.`}
        confirmLabel="Change mode anyway"
      />
    </div>
  );
}
