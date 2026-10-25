import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Menu as MenuIcon, X } from 'lucide-react';
import Logo from '../ui/Logo';
import Button from '../ui/Button';
import MegaMenu from './MegaMenu';
import { NAV_ITEMS } from './menuData';
import { useScrolled } from '../../hooks/useScrollSpy';
import { useAuthStore } from '../../store/authStore';
import { homeFor } from '../../lib/fakeBackend';
import { cx } from '../../lib/cx';

function AuthActions({ onNavigate, stacked }) {
  const session = useAuthStore((s) => s.session);
  if (session) {
    return (
      <Button variant="pill" size={stacked ? 'xl' : 'lg'} to={homeFor(session.role)} onClick={onNavigate} className={stacked ? 'w-full' : ''}>
        {session.role === 'owner' ? 'Go to admin' : 'Go to console'}
      </Button>
    );
  }
  return (
    <>
      <Link to="/login" onClick={onNavigate} className={cx('font-medium text-ink hover:text-teal-700', stacked ? 'py-3 text-lg' : 'px-3 text-[15px]')}>
        Log in
      </Link>
      <Button variant="pill" size={stacked ? 'xl' : 'lg'} to="/signup" onClick={onNavigate} className={stacked ? 'w-full' : ''}>
        Start free
      </Button>
    </>
  );
}

export default function Navbar() {
  const scrolled = useScrolled();
  const [openId, setOpenId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef();
  const navRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    setOpenId(null);
    setMobileOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && (setOpenId(null), setMobileOpen(false));
    const onDoc = (e) => !navRef.current?.contains(e.target) && setOpenId(null);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
  }, [mobileOpen]);

  const hoverOpen = (id) => {
    clearTimeout(closeTimer.current);
    setOpenId(id);
  };
  const hoverClose = () => {
    closeTimer.current = setTimeout(() => setOpenId(null), 140);
  };
  const close = () => setOpenId(null);
  const active = NAV_ITEMS.find((n) => n.id === openId);

  return (
    <header ref={navRef} className={cx('sticky top-0 z-40 bg-white transition-[border-color]', scrolled || openId ? 'border-b border-black/10' : 'border-b border-transparent')} onMouseLeave={hoverClose}>
      <nav className="mk-container flex h-[72px] items-center justify-between gap-6" aria-label="Main">
        <Logo />
        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.id} onMouseEnter={() => (item.items ? hoverOpen(item.id) : hoverClose())}>
              {item.items ? (
                <button
                  type="button"
                  aria-expanded={openId === item.id}
                  aria-controls={`mega-${item.id}`}
                  onClick={() => setOpenId(openId === item.id ? null : item.id)}
                  className={cx('inline-flex h-10 items-center gap-1 rounded-full px-4 text-[15px] font-medium transition hover:bg-cream', openId === item.id && 'bg-cream')}
                >
                  {item.label}
                  <ChevronDown className={cx('h-4 w-4 transition-transform', openId === item.id && 'rotate-180')} aria-hidden="true" />
                </button>
              ) : (
                <Link to={item.to} className="inline-flex h-10 items-center rounded-full px-4 text-[15px] font-medium transition hover:bg-cream">
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-2 lg:flex">
          <AuthActions />
        </div>
        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-cream lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu" aria-expanded={mobileOpen}>
          <MenuIcon className="h-6 w-6" />
        </button>
      </nav>

      {active?.items && (
        <div onMouseEnter={() => hoverOpen(active.id)}>
          <MegaMenu id={`mega-${active.id}`} items={active.items} onNavigate={close} />
        </div>
      )}

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex h-[72px] items-center justify-between px-4">
            <Logo />
            <button type="button" onClick={() => setMobileOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-cream" aria-label="Close menu">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex-1 px-4 pb-8">
            {NAV_ITEMS.map((item) =>
              item.items ? (
                <details key={item.id} className="group border-b border-black/10">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-5 text-2xl">
                    {item.label}
                    <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <ul className="space-y-1 pb-4">
                    {item.items.map((sub) => (
                      <li key={sub.title}>
                        <Link to={sub.to} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl p-2 hover:bg-cream">
                          <sub.icon className="h-5 w-5 text-teal-700" aria-hidden="true" />
                          <span>
                            <span className="block font-medium">{sub.title}</span>
                            <span className="block text-sm text-black/60">{sub.text}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <Link key={item.id} to={item.to} onClick={() => setMobileOpen(false)} className="block border-b border-black/10 py-5 text-2xl">
                  {item.label}
                </Link>
              ),
            )}
            <div className="mt-8 flex flex-col gap-3">
              <AuthActions stacked onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
