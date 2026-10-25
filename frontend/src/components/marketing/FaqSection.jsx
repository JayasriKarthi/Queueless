import { FAQS } from '../../data/faqs';
import Accordion from '../ui/Accordion';
import Reveal from './Reveal';

export default function FaqSection() {
  return (
    <section id="faq" className="bg-white">
      <div className="mk-container mk-section grid gap-12 md:grid-cols-[1fr_1.6fr]">
        <Reveal>
          <h2 className="text-display-sm font-normal">Questions, answered</h2>
        </Reveal>
        <Reveal delay={100}>
          <Accordion items={FAQS} className="border-t border-black/10" />
        </Reveal>
      </div>
    </section>
  );
}
