import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTenant, useTenantTokens } from '../../hooks/useTenant';
import { saveSettings, updateBranding, markSetup } from '../../lib/fakeBackend';
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
  const dirty = !same(draft, original);

  // Pick up changes saved elsewhere (another tab, simulation) when nothing is being edited.
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

  const commit = () => {
    const { branding, ...rest } = draft;
    saveSettings(business.id, rest);
    if (!same(branding, original.branding)) updateBranding(business.id, branding);
    if (!same(draft.settings.customerFields, original.settings.customerFields)) markSetup(business.id, 'joinFormCustomised');
    if (!same(draft.hours, original.hours)) markSetup(business.id, 'hoursSet');
    setModeWarn(false);
    toast('Settings saved');
  };
  const save = () => {
    if (!draft.name.trim()) return toast('Business name cannot be empty', { tone: 'critical' });
    if (draft.settings.queueMode !== original.settings.queueMode && activeTokens > 0) return setModeWarn(true);
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
              <Button size="sm" variant="pillLight" className="!rounded-lg" onClick={save}>Save</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={modeWarn}
        onClose={() => setModeWarn(false)}
        onConfirm={commit}
        tone="primary"
        title="Change queue mode while people are waiting?"
        message={`${activeTokens} token${activeTokens === 1 ? ' is' : 's are'} active right now. They stay in their current line, but new customers will join using "${QUEUE_MODES[draft.settings.queueMode].label}". Waiting estimates may jump for a while.`}
        confirmLabel="Change mode anyway"
      />
    </div>
  );
}
