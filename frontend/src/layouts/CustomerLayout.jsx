import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useBusinessStore } from '../store/businessStore';
import { useBrand } from '../hooks/useBrand';
import { resolveSlug } from '../lib/fakeBackend';
import { hasFeature } from '../config/plans';
import { RESERVED_SLUGS } from '../config/constants';
import { LogoMark } from '../components/ui/Logo';
import NotFound from '../pages/NotFound';

export function PoweredBy({ business, dark }) {
  if (business.branding.hidePoweredBy && hasFeature(business.plan, 'removeBranding')) return null;
  return (
    <a href="/" className={`inline-flex items-center gap-1.5 text-xs ${dark ? 'text-white/50 hover:text-white/80' : 'text-black/45 hover:text-black/70 dark:text-white/45'}`}>
      <LogoMark size={14} /> Powered by QueueLess
    </a>
  );
}

// Public pages are scoped by slug only. Old slugs redirect to the current one.
export default function CustomerLayout() {
  const { slug } = useParams();
  const location = useLocation();
  useBusinessStore((s) => s.businesses); // re-render on business changes
  const { business, redirectTo } = RESERVED_SLUGS.includes(slug) ? {} : resolveSlug(slug);
  const vars = useBrand(business);

  if (redirectTo) {
    const rest = location.pathname.slice(slug.length + 1);
    return <Navigate to={`/${redirectTo}${rest}${location.search}`} replace />;
  }
  if (!business) return <NotFound />;

  return (
    <div style={vars} className="min-h-screen bg-[#F6F7F8] text-[#1A1A1A] dark:bg-neutral-950 dark:text-neutral-100">
      <div className="h-1.5 w-full bg-[var(--brand)]" aria-hidden="true" />
      <main id="main" className="mx-auto w-full max-w-md px-4 pb-10 pt-5">
        <Outlet context={{ business }} />
      </main>
      <footer className="pb-8 text-center">
        <PoweredBy business={business} />
      </footer>
    </div>
  );
}
