import { X } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { cx } from '../../lib/cx';

export default function ToastViewport() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);
  return (
    <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx('pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white shadow-pop animate-fade-up', t.tone === 'critical' ? 'bg-[#8E0B21]' : 'bg-[#1A1A1A]')}
        >
          <span>{t.message}</span>
          <button type="button" onClick={() => dismiss(t.id)} className="rounded p-0.5 hover:bg-white/15" aria-label="Dismiss notification">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
