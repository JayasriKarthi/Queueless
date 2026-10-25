import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import DashboardPreview from './DashboardPreview';
import PhoneMockup from './PhoneMockup';
import TvMockup from './TvMockup';
import { useAuthStore } from '../../store/authStore';
import { homeFor } from '../../lib/fakeBackend';

export default function Hero() {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const submit = (e) => {
    e.preventDefault();
    if (session) return navigate(homeFor(session.role));
    navigate(`/signup${email ? `?email=${encodeURIComponent(email)}` : ''}`);
  };
  return (
    <section className="overflow-hidden bg-white pt-14 md:pt-24">
      <div className="mk-container">
        <div className="max-w-4xl animate-fade-up">
          <h1 className="text-display font-normal">Skip the waiting room.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-black/70 md:text-xl">
            Let customers join the line from their phone, see their live position, and get alerted when it is almost their turn. No app, no account, no crowded counters.
          </p>
          <form onSubmit={submit} className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row sm:rounded-full sm:border sm:border-black/15 sm:p-1.5 sm:focus-within:ring-2 sm:focus-within:ring-teal">
            {!session && (
              <>
                <label htmlFor="hero-email" className="sr-only">Work email</label>
                <input
                  id="hero-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your work email"
                  className="h-14 flex-1 rounded-full border border-black/15 px-6 text-base outline-none focus:ring-2 focus:ring-teal sm:h-12 sm:border-0 sm:focus:ring-0"
                />
              </>
            )}
            <button type="submit" className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-ink px-7 text-base font-medium text-white hover:bg-ink-soft sm:h-12">
              {session ? 'Go to admin' : 'Start free'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
          <p className="mt-3 text-sm text-black/55">Free plan available. No credit card required.</p>
          <Link to="/city-care" className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-medium text-teal-700 hover:underline">
            See a live demo <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="relative mx-auto mt-14 max-w-6xl pb-20 md:mt-20 md:pb-28">
          <DashboardPreview className="ml-auto md:w-[88%]" />
          <PhoneMockup className="absolute -bottom-2 left-0 scale-[.8] origin-bottom-left sm:left-2 sm:scale-100 md:bottom-0" />
          <TvMockup className="absolute -top-10 right-2 hidden w-72 md:block lg:-right-4" />
        </div>
      </div>
    </section>
  );
}
