import { useNavigate } from 'react-router-dom';
import { Users, LogOut, Moon, Sun, MoreVertical, Pause, Play } from 'lucide-react';
import { LogoMark } from '../ui/Logo';
import Avatar from '../ui/Avatar';
import Menu from '../ui/Menu';
import Button from '../ui/Button';
import { logout } from '../../lib/fakeBackend';
import { useUiStore } from '../../store/uiStore';

export default function StaffTopbar({ business, user, resources, resourceId, onResource, resource, onTogglePause }) {
  const navigate = useNavigate();
  const theme = useUiStore((s) => s.theme);
  const setUi = useUiStore((s) => s.set);
  return (
    <header className="sticky top-0 z-30 bg-admin-top text-white">
      <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-2 px-3 py-2">
        <LogoMark size={26} dark />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{business.name}</p>
          <p className="truncate text-xs text-white/60">{user.name} · {user.role === 'manager' ? 'Manager' : 'Staff'}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <span className="hidden sm:inline">{business.labels.resource}</span>
          <select
            value={resourceId}
            onChange={(e) => onResource(e.target.value)}
            disabled={resources.length < 2}
            className="h-9 rounded-lg border border-white/15 bg-admin-search px-2 text-[13px] text-white disabled:opacity-90"
            aria-label={`Choose ${business.labels.resource.toLowerCase()}`}
          >
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        {resource && (
          <Button size="md" icon={resource.isPaused ? Play : Pause} onClick={onTogglePause} className="min-h-[44px] !border-white/15 !bg-transparent !text-white hover:!bg-white/10" aria-pressed={resource.isPaused}>
            {resource.isPaused ? 'Resume' : 'Pause'}
          </Button>
        )}
        <Button size="md" icon={Users} to="/staff/switch-user" className="min-h-[44px] !border-white/15 !bg-transparent !text-white hover:!bg-white/10">
          Switch user
        </Button>
        <Menu
          trigger={(props) => (
            <button type="button" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10" aria-label="More options" {...props}>
              <MoreVertical className="h-5 w-5" />
            </button>
          )}
          header={<div className="flex items-center gap-2 px-2.5 py-2"><Avatar name={user.name} color={user.avatarColor} size={28} /><span className="font-medium">{user.name}</span></div>}
          items={[
            { divider: true },
            { label: theme === 'dark' ? 'Light mode' : 'Dark mode', icon: theme === 'dark' ? Sun : Moon, onClick: () => setUi({ theme: theme === 'dark' ? 'light' : 'dark' }) },
            { label: 'Log out', icon: LogOut, onClick: () => { logout(); navigate('/login'); } },
          ]}
        />
      </div>
    </header>
  );
}
