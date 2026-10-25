import { Link } from 'react-router-dom';
import { X, ArrowRight } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';

export default function AnnouncementBar() {
  const dismissed = useUiStore((s) => s.dismissed.announcement);
  const dismiss = useUiStore((s) => s.dismiss);
  if (dismissed) return null;
  return (
    <div className="relative bg-[#050F0D] px-10 py-2 text-center text-[13px] text-white/90">
      <span>Free plan available. Set up your queue in 5 minutes.</span>{' '}
      <Link to="/signup" className="inline-flex items-center gap-1 font-medium text-[#5FD3C4] hover:underline">
        Start free <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
      <button type="button" onClick={() => dismiss('announcement')} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full hover:bg-white/10" aria-label="Close announcement">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
