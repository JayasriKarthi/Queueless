import { TESTIMONIALS } from '../../data/faqs';
import Reveal from './Reveal';

export default function Testimonials() {
  return (
    <section className="bg-white" aria-label="What teams say">
      <div className="mk-container py-24">
        <div className="grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal as="figure" key={t.org} delay={i * 80} className="flex flex-col rounded-xl2 bg-cream p-8">
              <blockquote className="flex-1 text-xl leading-snug tracking-[-0.01em]">"{t.quote}"</blockquote>
              <figcaption className="mt-6 text-sm text-black/60">
                <span className="block font-medium text-ink">{t.name}</span>
                {t.org}
              </figcaption>
            </Reveal>
          ))}
        </div>
        <p className="mt-4 text-xs text-black/40">Illustrative quotes for this demo.</p>
      </div>
    </section>
  );
}
