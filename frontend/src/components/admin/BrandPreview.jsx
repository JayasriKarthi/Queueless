import { useMemo } from 'react';
import { brandVars } from '../../config/theme';
import { hasFeature } from '../../config/plans';
import BusinessLogo from '../ui/BusinessLogo';

// Live preview of the customer join page and TV display with draft branding.
export default function BrandPreview({ business, branding }) {
  const draft = useMemo(() => ({ ...business, branding }), [business, branding]);
  const vars = brandVars(branding.brandColor);
  const powered = !(branding.hidePoweredBy && hasFeature(business.plan, 'removeBranding'));
  return (
    <div style={vars} className="space-y-4" aria-label="Branding preview">
      <div>
        <p className="ql-subdued mb-1.5">Customer join page</p>
        <div className="overflow-hidden rounded-2xl border border-admin-border bg-[#F6F7F8] text-[#1A1A1A] dark:border-neutral-700">
          <div className="h-1.5 bg-[var(--brand)]" />
          <div className="p-4">
            <div className="flex items-center gap-2.5">
              <BusinessLogo business={draft} size={36} />
              <div>
                <p className="text-sm font-medium">{business.name}</p>
                <p className="text-[11px] text-[#0C5132]">● Open now</p>
              </div>
            </div>
            <p className="mt-3 text-[13px] text-black/70">{branding.welcomeMessage || 'Your welcome message appears here.'}</p>
            <div className="mt-3 rounded-xl bg-white p-3 shadow-card">
              <div className="h-7 rounded-lg border border-black/15" />
              <div className="mt-2 h-7 rounded-lg border border-black/15" />
              <div className="mt-3 flex h-9 items-center justify-center rounded-xl bg-[var(--brand)] text-[13px] font-medium text-[var(--brand-contrast)]">Get my token</div>
            </div>
            {powered && <p className="mt-3 text-center text-[10px] text-black/40">Powered by QueueLess</p>}
          </div>
        </div>
      </div>
      <div>
        <p className="ql-subdued mb-1.5">TV display</p>
        <div className="rounded-2xl bg-[#07110F] p-4 text-white">
          <div className="flex items-center gap-2">
            <BusinessLogo business={draft} size={24} rounded="rounded-md" />
            <span className="text-xs text-white/70">{business.name}</span>
          </div>
          <p className="mt-3 text-[10px] uppercase tracking-[.2em] text-white/50">Now serving</p>
          <p className="text-4xl font-medium text-[var(--brand)]" style={{ filter: 'brightness(1.25)' }}>A-012</p>
        </div>
      </div>
    </div>
  );
}
