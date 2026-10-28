import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useUiStore } from './store/uiStore';
import ToastViewport from './components/ui/Toast';
import RequireRole from './layouts/RequireRole';
import MarketingLayout from './layouts/MarketingLayout';
import AuthLayout from './layouts/AuthLayout';
import OnboardingLayout from './layouts/OnboardingLayout';
import AdminLayout from './layouts/AdminLayout';
import CustomerLayout from './layouts/CustomerLayout';
import StaffLayout from './layouts/StaffLayout';
import DisplayLayout from './layouts/DisplayLayout';
import Home from './pages/marketing/Home';
import ContactSales from './pages/marketing/ContactSales';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import AcceptInvite from './pages/auth/AcceptInvite';
import Welcome from './pages/onboarding/Welcome';
import PlanSelect from './pages/onboarding/PlanSelect';
import AdminHome from './pages/admin/Home';
import Queues from './pages/admin/Queues';
import Services from './pages/admin/Services';
import ServiceEdit from './pages/admin/ServiceEdit';
import Resources from './pages/admin/Resources';
import ResourceEdit from './pages/admin/ResourceEdit';
import Customers from './pages/admin/Customers';
import Analytics from './pages/admin/Analytics';
import Staff from './pages/admin/Staff';
import Channels from './pages/admin/Channels';
import Billing from './pages/admin/Billing';
import Settings from './pages/admin/Settings';
import Join from './pages/customer/Join';
import TokenStatus from './pages/customer/TokenStatus';
import Console from './pages/staff/Console';
import SwitchUser from './pages/staff/SwitchUser';
import Display from './pages/display/Display';
import NotFound from './pages/NotFound';

// Dark mode applies to admin, staff, and customer pages. Marketing and auth stay light.
function ThemeController() {
  const theme = useUiStore((s) => s.theme);
  const { pathname } = useLocation();
  useEffect(() => {
    const lightOnly = pathname === '/' || ['/pricing', '/enterprise', '/contact-sales', '/login', '/signup', '/onboarding', '/accept-invite', '/display'].some((p) => pathname.startsWith(p));
    document.documentElement.classList.toggle('dark', theme === 'dark' && !lightOnly);
  }, [theme, pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ThemeController />
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Home section="pricing" />} />
          <Route path="/enterprise" element={<Home section="enterprise" />} />
          <Route path="/contact-sales" element={<ContactSales />} />
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/accept-invite/:token" element={<AcceptInvite />} />
        </Route>

        <Route path="/onboarding" element={<RequireRole role="owner"><OnboardingLayout /></RequireRole>}>
          <Route path="welcome" element={<Welcome />} />
          <Route path="plan" element={<PlanSelect />} />
        </Route>

        <Route path="/admin" element={<RequireRole role="owner"><AdminLayout /></RequireRole>}>
          <Route index element={<AdminHome />} />
          <Route path="queues" element={<Queues />} />
          <Route path="services" element={<Services />} />
          <Route path="services/new" element={<ServiceEdit />} />
          <Route path="services/:id" element={<ServiceEdit />} />
          <Route path="resources" element={<Resources />} />
          <Route path="resources/new" element={<ResourceEdit />} />
          <Route path="resources/:id" element={<ResourceEdit />} />
          <Route path="customers" element={<Customers />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="staff" element={<Staff />} />
          <Route path="channels" element={<Channels />} />
          <Route path="billing" element={<Billing />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound inline />} />
        </Route>

        <Route path="/staff" element={<RequireRole role="staff"><StaffLayout /></RequireRole>}>
          <Route index element={<Console />} />
          <Route path="switch-user" element={<SwitchUser />} />
        </Route>

        <Route path="/display/:slug" element={<DisplayLayout />}>
          <Route index element={<Display />} />
        </Route>

        <Route path="/:slug" element={<CustomerLayout />}>
          <Route index element={<Join />} />
          <Route path="token/:tokenId" element={<TokenStatus />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <ToastViewport />
    </>
  );
}
