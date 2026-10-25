import { useId } from 'react';
import { X } from 'lucide-react';
import { cx } from '../../lib/cx';
import Overlay from './Overlay';

export default function Drawer({ open, onClose, title, children, footer, side = 'right', width = 'max-w-md' }) {
  const id = useId();
  return (
    <Overlay open={open} onClose={onClose} labelledBy={id}>
      <aside
        className={cx(
          'fixed top-0 bottom-0 z-10 flex w-full flex-col bg-white shadow-pop dark:bg-neutral-900 dark:text-neutral-100',
          width,
          side === 'right' ? 'right-0 animate-slide-in' : 'left-0 animate-slide-in-left',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-admin-border px-4 h-14 dark:border-neutral-800">
          <h2 id={id} className="text-sm font-medium">{title}</h2>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center" aria-label="Close panel">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-sm">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-admin-border px-4 py-3 dark:border-neutral-800">{footer}</div>}
      </aside>
    </Overlay>
  );
}
