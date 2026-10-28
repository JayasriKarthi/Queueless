import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { homeFor } from '../lib/fakeBackend';
import Spinner from '../components/ui/Spinner';

const ROLE_GROUP = { owner: ['owner'], staff: ['staff', 'manager'] };

// Waits for the session check, then: not logged in -> /login?next=..., wrong role -> that role's home.
export default function RequireRole({ role, children }) {
  const status = useAuthStore((s) => s.status);
  const session = useAuthStore((s) => s.session);
  const location = useLocation();
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (!ROLE_GROUP[role].includes(session.role)) return <Navigate to={homeFor(session.role)} replace />;
  return children;
}
