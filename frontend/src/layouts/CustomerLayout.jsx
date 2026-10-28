import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useBrand } from '../hooks/useBrand';
import { usePublicBusiness } from '../hooks/usePublicBusiness';
import { hasFeature } from '../config/plans';
import { RESERVED_SLUGS } from '../config/constants';
import { LogoMark } from '../components/ui/Logo';
import Spinner from '../components/ui/Spinner';
import NotFound from '../pages/NotFound';

// Public pages get `showPoweredBy` from the server (it knows the plan); admin previews use the plan.
export function PoweredBy({ business, dark }) {
  const show = business.showPoweredBy ?? !(business.branding.hidePoweredBy && hasFeature(business.plan, 'removeBranding'));
  if (!show) return null;
  return (
    <a href="/" className={`inline-flex items-center gap-1.5 text-xs ${dark ? 'text-white/50 hover:text-white/80' : 'text-black/45 hover:text-black/70 dark:text-white/45'}`}>
      <LogoMark size={14} /> Powered by QueueLess
    </a>
  );
}

// Public pages are scoped by slug only, loaded from the API and kept live. An old slug comes
// back as the business under its new slug, and the address bar follows.
export default function CustomerLayout() {
  const { slug } = useParams();
  const location = useLocation();
  const { state, business, reload } = usePublicBusiness(RESERVED_SLUGS.includes(slug) ? null : slug);
  const vars = useBrand(business);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F7F8]" role="status" aria-label="Loading">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (!business) return <NotFound />;
  if (business.slug !== slug) {
    const rest = location.pathname.slice(slug.length + 1);
    return <Navigate to={`/${business.slug}${rest}${location.search}`} replace />;
  }

  return (
    <div style={vars} className="min-h-screen bg-[#F6F7F8] text-[#1A1A1A] dark:bg-neutral-950 dark:text-neutral-100">
      <div className="h-1.5 w-full bg-[var(--brand)]" aria-hidden="true" />
      <main id="main" className="mx-auto w-full max-w-md px-4 pb-10 pt-5">
        <Outlet context={{ business, reload }} />
      </main>
      <footer className="pb-8 text-center">
        <PoweredBy business={business} />
      </footer>
    </div>
  );
}
