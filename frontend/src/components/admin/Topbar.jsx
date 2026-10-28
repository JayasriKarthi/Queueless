import { useNavigate } from 'react-router-dom';
import { Search, Bell, HelpCircle, Menu as MenuIcon, UserRound, Repeat, LogOut, Moon, Sun, ExternalLink } from 'lucide-react';
import Menu from '../ui/Menu';
import Avatar from '../ui/Avatar';
import { LogoMark } from '../ui/Logo';
import { useTenant, useTenantCollection } from '../../hooks/useTenant';
import { useUiStore, toast } from '../../store/uiStore';
import { useBusinessStore } from '../../store/businessStore';
import { logout, markNotificationsRead } from '../../lib/fakeBackend';
import { timeAgo } from '../../lib/formatters';

const iconBtn = 'relative flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white';

function Notifications({ businessId }) {
  const items = useTenantCollection(useBusinessStore, 'notifications');
  const unread = items.filter((n) => !n.read).length;
  return (
    <Menu
      trigger={(props) => (
        <button type="button" className={iconBtn} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} {...props} onClick={(e) => { props.onClick(e); markNotificationsRead(businessId); }}>
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#E51C00] ring-2 ring-admin-top" />}
        </button>
      )}
      header={
        <div className="w-[300px] max-w-[80vw]">
          <p className="px-2.5 py-1.5 font-medium">Notifications</p>
          {items.length === 0 && <p className="px-2.5 py-4 text-admin-muted">You are all caught up.</p>}
          {items.slice(0, 5).map((n) => (
            <div key={n.id} className="rounded-lg px-2.5 py-2 hover:bg-[#F1F1F1] dark:hover:bg-neutral-800">
              <p className="font-medium">{n.title}</p>
              <p className="text-admin-muted">{n.body}</p>
              <p className="mt-0.5 text-[11px] text-admin-muted">{timeAgo(n.at)}</p>
            </div>
          ))}
        </div>
      }
      items={[]}
    />
  );
}

export default function Topbar() {
  const { business, user } = useTenant();
  const setUi = useUiStore((s) => s.set);
  const theme = useUiStore((s) => s.theme);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-admin-top px-2 sm:px-3">
      <button type="button" className={`${iconBtn} md:hidden`} onClick={() => setUi({ mobileNavOpen: true })} aria-label="Open navigation">
        <MenuIcon className="h-5 w-5" />
      </button>
      <div className="flex min-w-0 items-center gap-2 md:w-[228px]">
        <LogoMark size={26} dark />
        <span className="hidden truncate text-[13px] font-medium text-white sm:inline">{business.name}</span>
      </div>
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={() => setUi({ paletteOpen: true })}
          className="flex h-9 w-full max-w-[560px] items-center gap-2 rounded-lg border border-white/10 bg-admin-search px-3 text-left text-[13px] text-white/90 hover:border-white/25"
          aria-label="Search, or press Control K"
        >
          <Search className="h-4 w-4 shrink-0 text-white/70" aria-hidden="true" />
          <span className="flex-1 truncate text-white/80">Search</span>
          <kbd className="hidden rounded border border-white/20 px-1.5 text-[11px] text-white/70 sm:inline">Ctrl K</kbd>
        </button>
      </div>
      <div className="flex items-center gap-0.5">
        <Notifications businessId={business.id} />
        <Menu
          trigger={(props) => (
            <button type="button" className={`${iconBtn} hidden sm:flex`} aria-label="Help" {...props}>
              <HelpCircle className="h-[18px] w-[18px]" />
            </button>
          )}
          items={[
            { label: 'Open setup guide', onClick: () => navigate('/admin') },
            { label: 'Read the FAQ', icon: ExternalLink, onClick: () => window.open('/#faq', '_blank', 'noopener') },
            { label: 'Keyboard shortcuts', hint: 'Ctrl K', onClick: () => setUi({ paletteOpen: true }) },
          ]}
        />
        <Menu
          trigger={(props) => (
            <button type="button" className="ml-1 flex h-9 items-center gap-2 rounded-lg px-1.5 hover:bg-white/10" aria-label="Account menu" {...props}>
              <Avatar name={user.name} color="#0E9F8E" size={28} />
            </button>
          )}
          header={
            <div className="px-2.5 py-2">
              <p className="font-medium">{business.name}</p>
              <p className="text-admin-muted">{user.name} · {user.email}</p>
            </div>
          }
          items={[
            { divider: true },
            { label: 'Profile', icon: UserRound, onClick: () => toast('Profile settings are a placeholder in this demo') },
            { label: 'Switch business', icon: Repeat, onClick: () => toast('Switching between businesses is coming soon') },
            { label: theme === 'dark' ? 'Light mode' : 'Dark mode', icon: theme === 'dark' ? Sun : Moon, onClick: () => setUi({ theme: theme === 'dark' ? 'light' : 'dark' }) },
            { divider: true },
            { label: 'Log out', icon: LogOut, onClick: async () => { await logout(); navigate('/login'); } },
          ]}
        />
      </div>
    </header>
  );
}
