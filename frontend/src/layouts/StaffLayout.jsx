import { Outlet } from 'react-router-dom';
import TenantGate from './TenantGate';
import ErrorBoundary from '../components/ui/ErrorBoundary';

export default function StaffLayout() {
  return (
    <div className="min-h-screen bg-admin-bg text-[14px] text-[#303030] dark:bg-neutral-950 dark:text-neutral-200">
      <TenantGate home="/staff">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </TenantGate>
    </div>
  );
}
