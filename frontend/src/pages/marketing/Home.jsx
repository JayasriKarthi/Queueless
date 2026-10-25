import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Hero from '../../components/marketing/Hero';
import BuiltForStrip from '../../components/marketing/BuiltForStrip';
import WhySection from '../../components/marketing/WhySection';
import StatsBand from '../../components/marketing/StatsBand';
import ProductsSection from '../../components/marketing/ProductsSection';
import Testimonials from '../../components/marketing/Testimonials';
import PricingSection from '../../components/marketing/PricingSection';
import EnterpriseSection from '../../components/marketing/EnterpriseSection';
import FaqSection from '../../components/marketing/FaqSection';
import CtaBand from '../../components/marketing/CtaBand';

// One long page. /pricing and /enterprise render it scrolled to that section.
export default function Home({ section }) {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    const target = section ?? hash.replace('#', '');
    if (!target) {
      window.scrollTo(0, 0);
      return undefined;
    }
    const id = setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    return () => clearTimeout(id);
  }, [section, hash, pathname]);

  return (
    <>
      <Hero />
      <BuiltForStrip />
      <WhySection />
      <StatsBand />
      <ProductsSection />
      <Testimonials />
      <PricingSection />
      <EnterpriseSection />
      <FaqSection />
      <CtaBand />
    </>
  );
}
