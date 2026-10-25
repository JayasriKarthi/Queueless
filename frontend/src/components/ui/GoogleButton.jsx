import { toast } from '../../store/uiStore';

// Mock only: no OAuth request is made.
export default function GoogleButton({ label = 'Continue with Google' }) {
  return (
    <button
      type="button"
      onClick={() => toast('Google sign-in is a mock in this demo. Use email instead.')}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-admin-border bg-white text-sm font-medium hover:bg-[#F7F7F7]"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <circle cx="9" cy="9" r="8" fill="none" stroke="#8A8A8A" strokeWidth="2" />
        <path d="M9 5.5v7M5.5 9h7" stroke="#8A8A8A" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {label}
    </button>
  );
}
