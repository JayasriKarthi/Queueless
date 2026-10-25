import { useId } from 'react';
import { X } from 'lucide-react';
import { cx } from '../../lib/cx';
import Overlay from './Overlay';

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export default function Modal({ open, onClose, title, children, footer, size = 'md', className, hideClose }) {
  const id = useId();
  return (
    <Overlay open={open} onClose={onClose} labelledBy={id}>
      <div className="pointer-events-none fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div className={cx('pointer-events-auto relative w-full max-h-[92vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-pop animate-pop dark:bg-neutral-900 dark:text-neutral-100', SIZES[size], className)}>
          {title && (
            <div className="flex items-center justify-between gap-3 border-b border-admin-border bg-[#F7F7F7] px-4 py-3 dark:bg-neutral-800 dark:border-neutral-700">
              <h2 id={id} className="text-sm font-medium">{title}</h2>
              {!hideClose && (
                <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          <div className="overflow-y-auto p-4 text-sm">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-admin-border px-4 py-3 dark:border-neutral-700">{footer}</div>}
        </div>
      </div>
    </Overlay>
  );
}
