import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useBrand } from '../hooks/useBrand';
import { useDisplay } from '../hooks/useDisplay';

// The TV display is always dark and has no clickable chrome. Its data comes from the API and
// stays live; an old link shows the business under its new link.
export default function DisplayLayout() {
  const { slug } = useParams();
  const { state, display, lastCall } = useDisplay(slug);
  const vars = useBrand(display);
  if (display && display.slug !== slug) return <Navigate to={`/display/${display.slug}`} replace />;
  return (
    <div style={vars} className="dark min-h-screen overflow-hidden bg-[#07110F] text-white">
      {state === 'ready' || state === 'locked' ? (
        <Outlet context={{ display, locked: state === 'locked', lastCall }} />
      ) : (
        <div className="flex min-h-screen items-center justify-center text-center">
          {state === 'missing' && (
            <div>
              <p className="text-4xl font-medium">Display not found</p>
              <p className="mt-3 text-white/60">Check the link on your Channels page.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
