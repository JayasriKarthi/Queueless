import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { cx } from '../../lib/cx';

export default function Accordion({ items, className, itemClassName }) {
  const [open, setOpen] = useState(0);
  const base = useId();
  return (
    <div className={cx('divide-y divide-black/10', className)}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className={itemClassName}>
            <h3>
              <button
                type="button"
                id={`${base}-h${i}`}
                aria-expanded={isOpen}
                aria-controls={`${base}-p${i}`}
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="flex w-full items-center justify-between gap-6 py-6 text-left text-lg md:text-xl"
              >
                {item.q}
                <Plus className={cx('h-5 w-5 shrink-0 transition-transform', isOpen && 'rotate-45')} aria-hidden="true" />
              </button>
            </h3>
            <div id={`${base}-p${i}`} role="region" aria-labelledby={`${base}-h${i}`} hidden={!isOpen} className="pb-6 pr-10 text-[17px] leading-relaxed text-black/70">
              {item.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}
