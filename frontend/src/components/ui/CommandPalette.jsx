import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ExternalLink, Moon, RotateCcw, UserPlus, Plus, CornerDownLeft } from 'lucide-react';
import { useUiStore, toast } from '../../store/uiStore';
import { useTenant } from '../../hooks/useTenant';
import { adminNav } from '../../config/navigation';
import { resetDemo } from '../../lib/fakeBackend';
import { cx } from '../../lib/cx';
import Overlay from './Overlay';

export default function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const setUi = useUiStore((s) => s.set);
  const { business } = useTenant();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const close = () => setUi({ paletteOpen: false });

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setUi({ paletteOpen: !useUiStore.getState().paletteOpen });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setUi]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const commands = useMemo(() => {
    const pages = adminNav(business?.labels).map((n) => ({ id: n.to, label: `Go to ${n.label}`, group: 'Pages', icon: n.icon, run: () => navigate(n.to) }));
    const actions = [
      { id: 'add-service', label: 'Add a service', group: 'Actions', icon: Plus, run: () => navigate('/admin/services/new') },
      { id: 'invite', label: 'Invite staff', group: 'Actions', icon: UserPlus, run: () => navigate('/admin/staff?invite=1') },
      business && { id: 'join', label: 'Open customer join page', group: 'Actions', icon: ExternalLink, run: () => window.open(`/${business.slug}`, '_blank', 'noopener') },
      { id: 'theme', label: 'Toggle dark mode', group: 'Actions', icon: Moon, run: () => setUi({ theme: useUiStore.getState().theme === 'dark' ? 'light' : 'dark' }) },
      {
        id: 'reset', label: 'Reset demo data', group: 'Actions', icon: RotateCcw,
        run: () => {
          const r = resetDemo();
          toast('Demo data restored');
          if (r.loggedOut) navigate('/login');
        },
      },
    ].filter(Boolean);
    return [...pages, ...actions];
  }, [business, navigate, setUi]);

  const results = commands.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()));

  const run = (cmd) => {
    close();
    cmd?.run();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[active]);
    }
  };

  let lastGroup = null;
  return (
    <Overlay open={open} onClose={close} labelledBy="palette-label">
      <div className="pointer-events-none fixed inset-0 flex items-start justify-center px-4 pt-[12vh]">
        <div className="pointer-events-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-pop animate-pop dark:bg-neutral-900 dark:text-neutral-100">
          <label id="palette-label" className="flex items-center gap-2 border-b border-admin-border px-4 dark:border-neutral-700">
            <Search className="h-4 w-4 text-admin-muted" aria-hidden="true" />
            <span className="sr-only">Search commands</span>
            <input
              data-autofocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search pages and actions"
              className="h-12 w-full bg-transparent text-sm outline-none"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
              aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
            />
            <kbd className="rounded border border-admin-border px-1.5 text-[11px] text-admin-muted">Esc</kbd>
          </label>
          <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5 text-[13px]">
            {results.length === 0 && <li className="px-3 py-6 text-center text-admin-muted">No matches for "{query}"</li>}
            {results.map((c, i) => {
              const header = c.group !== lastGroup ? c.group : null;
              lastGroup = c.group;
              return (
                <li key={c.id} role="presentation">
                  {header && <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-admin-muted">{header}</p>}
                  <button
                    id={`cmd-${c.id}`}
                    role="option"
                    aria-selected={i === active}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(c)}
                    className={cx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left', i === active && 'bg-[#F1F1F1] dark:bg-neutral-800')}
                  >
                    <c.icon className="h-4 w-4 text-admin-muted" aria-hidden="true" />
                    <span className="flex-1">{c.label}</span>
                    {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-admin-muted" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Overlay>
  );
}
