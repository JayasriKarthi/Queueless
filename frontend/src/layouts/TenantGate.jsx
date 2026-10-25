import { useSearchParams, Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { resolveSlug } from '../lib/fakeBackend';
import StatusScreen from '../components/ui/StatusScreen';
import Button from '../components/ui/Button';

// If the URL asks for another business (?business=<slug>), refuse instead of showing its data.
export default function TenantGate({ children, home }) {
  const [params] = useSearchParams();
  const businessId = useAuthStore((s) => s.session?.businessId);
  const requested = params.get('business');
  if (requested) {
    const { business, redirectTo } = resolveSlug(requested);
    const target = business ?? (redirectTo && resolveSlug(redirectTo).business);
    if (!target || target.id !== businessId) {
      return (
        <StatusScreen icon={ShieldAlert} tone="critical" title="Access denied" actions={<Button variant="primary" to={home}>Back to my business</Button>}>
          <p>Your account belongs to a different business, so you cannot see this business's queues, staff, or customers.</p>
          <p className="mt-2">
            Need access? Ask that business's owner to invite you, or <Link className="underline" to="/login">log in with another account</Link>.
          </p>
        </StatusScreen>
      );
    }
  }
  return children;
}
