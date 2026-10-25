import Button from '../ui/Button';
import { useAuthStore } from '../../store/authStore';
import { homeFor } from '../../lib/fakeBackend';

export default function CtaBand() {
  const session = useAuthStore((s) => s.session);
  return (
    <section className="bg-ink text-white">
      <div className="mk-container py-28 text-center md:py-36">
        <h2 className="mx-auto max-w-4xl text-display font-normal">Your line, minus the line.</h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-white/70">Set up your queue in five minutes. Free forever for one counter.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {session ? (
            <Button variant="pillLight" size="xl" to={homeFor(session.role)}>Go to admin</Button>
          ) : (
            <Button variant="pillLight" size="xl" to="/signup">Start free</Button>
          )}
          <Button variant="pillOutlineLight" size="xl" to="/city-care">See a live demo</Button>
        </div>
      </div>
    </section>
  );
}
