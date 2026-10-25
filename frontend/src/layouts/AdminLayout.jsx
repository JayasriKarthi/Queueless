import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Topbar from '../components/admin/Topbar';
import Sidebar from '../components/admin/Sidebar';
import PlanBanner from '../components/admin/PlanBanner';
import CommandPalette from '../components/ui/CommandPalette';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import Drawer from '../components/ui/Drawer';
import TenantGate from './TenantGate';
import { useUiStore } from '../store/uiStore';
import { cx } from '../lib/cx';

export default function AdminLayout() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const mobileOpen = useUiStore((s) => s.mobileNavOpen);
  const setUi = useUiStore((s) => s.set);
  const { pathname } = useLocation();

  useEffect(() => {
    setUi({ mobileNavOpen: false });
    window.scrollTo(0, 0);
  }, [pathname, setUi]);

  return (
    <div className="min-h-screen bg-admin-bg text-[14px] text-[#303030] dark:bg-neutral-950 dark:text-neutral-200">
      <Topbar />
      <PlanBanner />
      <div className="flex">
        <aside className={cx('sticky top-14 hidden h-[calc(100vh-56px)] shrink-0 overflow-y-auto transition-[width] md:block', collapsed ? 'w-[64px]' : 'w-[240px]')} aria-label="Admin navigation">
          <Sidebar collapsed={collapsed} />
        </aside>
        <Drawer open={mobileOpen} onClose={() => setUi({ mobileNavOpen: false })} title="Menu" side="left" width="max-w-[280px]">
          <div className="-m-4">
            <Sidebar />
          </div>
        </Drawer>
        <main id="main" className="min-w-0 flex-1 px-3 py-5 sm:px-5 md:py-6">
          <div className="mx-auto max-w-admin">
            <TenantGate home="/admin">
              <ErrorBoundary key={pathname}>
                <Outlet />
              </ErrorBoundary>
            </TenantGate>
          </div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
