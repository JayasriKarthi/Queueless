import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useBusinessStore } from '../store/businessStore';
import { useBrand } from '../hooks/useBrand';
import { resolveSlug } from '../lib/fakeBackend';

// The TV display is always dark and has no clickable chrome.
export default function DisplayLayout() {
  const { slug } = useParams();
  useBusinessStore((s) => s.businesses);
  const { business, redirectTo } = resolveSlug(slug);
  const vars = useBrand(business);
  if (redirectTo) return <Navigate to={`/display/${redirectTo}`} replace />;
  return (
    <div style={vars} className="dark min-h-screen overflow-hidden bg-[#07110F] text-white">
      {business ? (
        <Outlet context={{ business }} />
      ) : (
        <div className="flex min-h-screen items-center justify-center text-center">
          <div>
            <p className="text-4xl font-medium">Display not found</p>
            <p className="mt-3 text-white/60">Check the link on your Channels page.</p>
          </div>
        </div>
      )}
    </div>
  );
}
