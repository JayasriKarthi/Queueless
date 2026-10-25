import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, ExternalLink } from 'lucide-react';
import { adminNav } from '../../config/navigation';
import { useTenant, useTenantTokens } from '../../hooks/useTenant';
import { useUiStore } from '../../store/uiStore';
import { cx } from '../../lib/cx';

function Item({ item, collapsed, badge }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cx(
          'flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] transition-colors',
          isActive ? 'bg-white font-medium text-[#1A1A1A] shadow-card dark:bg-neutral-800 dark:text-white' : 'text-[#303030] hover:bg-[#E3E3E3]/70 dark:text-neutral-300 dark:hover:bg-neutral-800/70',
          collapsed && 'justify-center',
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && badge > 0 && (
        <span className="rounded-full bg-[#E3E3E3] px-1.5 text-[11px] font-medium dark:bg-neutral-700" aria-label={`${badge} waiting`}>
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export default function Sidebar({ collapsed = false }) {
  const { business } = useTenant();
  const tokens = useTenantTokens();
  const setUi = useUiStore((s) => s.set);
  const nav = adminNav(business.labels);
  const waiting = tokens.filter((t) => t.status === 'WAITING').length;
  const group = (g) => nav.filter((n) => n.group === g);

  return (
    <nav className="flex h-full flex-col bg-admin-bg p-2 pt-3 dark:bg-neutral-950" aria-label="Admin">
      <div className="space-y-0.5">
        {group('main').map((item) => (
          <Item key={item.to} item={item} collapsed={collapsed} badge={item.badge ? waiting : 0} />
        ))}
      </div>
      {!collapsed && <p className="mt-5 px-2 pb-1 text-xs font-medium text-admin-muted">Channels</p>}
      {collapsed && <div className="my-3 h-px bg-admin-border dark:bg-neutral-800" />}
      <div className="space-y-0.5">
        {group('channels').map((item) => (
          <Item key={item.to} item={item} collapsed={collapsed} />
        ))}
        {!collapsed && (
          <a href={`/${business.slug}`} target="_blank" rel="noopener" className="flex h-8 items-center gap-2 rounded-lg px-2 pl-8 text-[13px] text-admin-muted hover:bg-[#E3E3E3]/70 dark:hover:bg-neutral-800">
            Join page <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>
      <div className="mt-auto space-y-0.5 border-t border-admin-border pt-2 dark:border-neutral-800">
        {group('bottom').map((item) => (
          <Item key={item.to} item={item} collapsed={collapsed} />
        ))}
        <button
          type="button"
          onClick={() => setUi({ sidebarCollapsed: !collapsed })}
          className={cx('hidden h-8 w-full items-center gap-2 rounded-lg px-2 text-[13px] text-admin-muted hover:bg-[#E3E3E3]/70 md:flex dark:hover:bg-neutral-800', collapsed && 'justify-center')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </nav>
  );
}
