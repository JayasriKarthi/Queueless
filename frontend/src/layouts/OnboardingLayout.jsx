import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/ui/Logo';
import Stepper from '../components/ui/Stepper';
import { logout } from '../lib/fakeBackend';

export default function OnboardingLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const step = pathname.endsWith('/plan') ? 1 : 0;
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="flex h-16 items-center justify-between gap-4 border-b border-black/5 bg-white px-4 sm:px-6">
        <Logo to="/" />
        <Stepper steps={['Your business', 'Your plan']} current={step} />
        <button
          type="button"
          className="text-sm text-admin-muted hover:text-ink"
          onClick={() => {
            logout();
            navigate('/');
          }}
        >
          Log out
        </button>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <Outlet />
      </main>
    </div>
  );
}
