import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Layers, UserRound, ClipboardList, Palette, QrCode, UserPlus } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { markSetup } from '../../lib/fakeBackend';
import { cx } from '../../lib/cx';
import Button from '../ui/Button';
import ProgressBar from '../ui/ProgressBar';

function Illustration({ icon: Icon }) {
  return (
    <div className="relative hidden h-28 w-36 shrink-0 sm:block" aria-hidden="true">
      <div className="absolute inset-x-2 bottom-0 top-4 rounded-2xl bg-teal-50 dark:bg-teal-900/30" />
      <div className="absolute left-6 top-0 h-16 w-24 rotate-[-4deg] rounded-xl border border-admin-border bg-white shadow-card dark:bg-neutral-800 dark:border-neutral-700">
        <div className="m-2 h-2 w-12 rounded bg-[#E3E3E3] dark:bg-neutral-600" />
        <div className="mx-2 h-2 w-16 rounded bg-[#EBEBEB] dark:bg-neutral-700" />
      </div>
      <span className="absolute bottom-3 right-5 flex h-11 w-11 items-center justify-center rounded-full bg-teal text-white shadow-pop">
        <Icon className="h-5 w-5" />
      </span>
    </div>
  );
}

function buildTasks(b, hasStaff) {
  const r = b.labels.resource.toLowerCase();
  return [
    { id: 'service', icon: Layers, title: 'Add a service', text: 'Services are what customers queue for, like "General consultation" or "Cash deposit". Set an average time so wait estimates are accurate.', done: b.services.length > 0, cta: 'Add service', to: '/admin/services/new', link: ['View services', '/admin/services'] },
    { id: 'resource', icon: UserRound, title: `Add a ${r === 'doctor' ? 'counter or doctor' : r}`, text: `Each ${r} calls customers from the line. Tell us which services each one handles.`, done: b.resources.some((x) => x.isActive), cta: `Add ${r}`, to: '/admin/resources/new', link: [`View ${b.labels.resourcePlural.toLowerCase()}`, '/admin/resources'] },
    { id: 'form', flag: 'joinFormCustomised', icon: ClipboardList, title: 'Customise the join form', text: 'Name and mobile number are always asked. Add fields like age, reason for visit, or account number.', done: b.setup.joinFormCustomised, cta: 'Edit join form', to: '/admin/settings?tab=form', link: ['Preview join page', `/${b.slug}`] },
    { id: 'brand', flag: 'brandingSet', icon: Palette, title: 'Set branding and hours', text: 'Upload your logo, pick a brand colour, write a welcome message, and set opening hours. All free.', done: b.setup.brandingSet && b.setup.hoursSet, cta: 'Set branding', to: '/admin/settings?tab=branding', link: ['Set hours', '/admin/settings?tab=hours'] },
    { id: 'qr', flag: 'qrPrinted', icon: QrCode, title: 'Print your QR code', text: 'Go live, then download your QR code or print a branded A4 poster for your entrance and waiting area.', done: b.setup.qrPrinted, cta: 'Open channels', to: '/admin/channels', link: ['What happens at go live?', '/admin/channels'] },
    { id: 'staff', flag: 'testTokenRun', icon: UserPlus, title: 'Invite staff and run a test token', text: 'Invite your team by email, then join your own queue from your phone to see the full flow.', done: hasStaff && b.setup.testTokenRun, cta: 'Invite staff', to: '/admin/staff?invite=1', link: ['Open join page', `/${b.slug}`] },
  ];
}

export default function SetupGuide({ business }) {
  const users = useAuthStore((s) => s.users);
  const invites = useAuthStore((s) => s.invites);
  const open = useUiStore((s) => s.setupGuideOpen);
  const setUi = useUiStore((s) => s.set);
  const hasStaff = users.some((u) => u.businessId === business.id && u.role !== 'owner') || invites.some((i) => i.businessId === business.id);
  const tasks = buildTasks(business, hasStaff);
  const doneCount = tasks.filter((t) => t.done).length;
  const [selected, setSelected] = useState(() => tasks.find((t) => !t.done)?.id ?? tasks[0].id);

  const toggleFlag = (task) => {
    if (!task.flag) return;
    markSetup(business.id, task.flag, !task.done);
    if (task.id === 'brand') markSetup(business.id, 'hoursSet', !task.done);
  };

  return (
    <section className="ql-card overflow-hidden" aria-labelledby="setup-title">
      <div className="flex items-start justify-between gap-3 p-4">
        <div>
          <h2 id="setup-title" className="text-sm font-medium">Setup guide</h2>
          <p className="ql-subdued mt-0.5">Use this personalised guide to get your queue live.</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="whitespace-nowrap text-xs text-admin-muted">{doneCount} of {tasks.length} tasks complete</span>
            <ProgressBar value={doneCount} max={tasks.length} className="w-28" label="Setup progress" />
          </div>
        </div>
        <button type="button" onClick={() => setUi({ setupGuideOpen: !open })} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-expanded={open} aria-label={open ? 'Collapse setup guide' : 'Expand setup guide'}>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <ul className="px-2 pb-2">
          {tasks.map((task) => {
            const isSel = selected === task.id;
            return (
              <li key={task.id} className={cx('rounded-lg', isSel && 'bg-[#F7F7F7] dark:bg-neutral-800/70')}>
                <div className="flex items-center gap-3 px-2 py-2">
                  <button
                    type="button"
                    onClick={() => toggleFlag(task)}
                    disabled={!task.flag}
                    aria-label={task.done ? `${task.title}: done` : `Mark "${task.title}" as done`}
                    className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition', task.done ? 'bg-[#303030] text-white dark:bg-teal' : 'border-[1.5px] border-dashed border-[#8A8A8A] hover:border-[#303030]')}
                  >
                    {task.done && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => setSelected(isSel ? null : task.id)} aria-expanded={isSel} className="flex min-h-[32px] flex-1 items-center justify-between gap-2 text-left">
                    <span className={cx('text-[13px]', isSel ? 'font-medium' : '', task.done && !isSel && 'text-admin-muted')}>{task.title}</span>
                    {!isSel && <ChevronDown className="h-4 w-4 text-admin-muted" aria-hidden="true" />}
                  </button>
                </div>
                {isSel && (
                  <div className="flex gap-4 pb-4 pl-11 pr-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-admin-muted dark:text-neutral-400">{task.text}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Button variant="primary" size="sm" to={task.to}>{task.cta}</Button>
                        <Button variant="plain" to={task.link[1]}>{task.link[0]}</Button>
                      </div>
                    </div>
                    <Illustration icon={task.icon} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
