import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useBusinessStore } from '../store/businessStore';
import { homeFor } from '../lib/fakeBackend';

const ROLE_GROUP = { owner: ['owner'], staff: ['staff', 'manager'] };

// Fake-session guard: not logged in -> /login?next=..., wrong role -> that role's home.
export default function RequireRole({ role, children }) {
  const session = useAuthStore((s) => s.session);
  const userExists = useAuthStore((s) => s.users.some((u) => u.id === s.session?.userId && u.status === 'active'));
  const businessExists = useBusinessStore((s) => s.businesses.some((b) => b.id === session?.businessId));
  const location = useLocation();
  if (!session || !userExists || !businessExists) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (!ROLE_GROUP[role].includes(session.role)) return <Navigate to={homeFor(session.role)} replace />;
  return children;
}
