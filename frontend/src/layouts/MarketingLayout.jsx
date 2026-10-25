import { Outlet } from 'react-router-dom';
import AnnouncementBar from '../components/marketing/AnnouncementBar';
import Navbar from '../components/marketing/Navbar';
import Footer from '../components/marketing/Footer';

export default function MarketingLayout() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <AnnouncementBar />
      <Navbar />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
