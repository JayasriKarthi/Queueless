import { useRef } from 'react';
import { Upload, Trash2, Check } from 'lucide-react';
import { BRAND_SWATCHES } from '../../../config/theme';
import { hasFeature } from '../../../config/plans';
import Button from '../../../components/ui/Button';
import Toggle from '../../../components/ui/Toggle';
import Textarea from '../../../components/ui/Textarea';
import BusinessLogo from '../../../components/ui/BusinessLogo';
import { LockBadge } from '../../../components/ui/LockedFeature';
import BrandPreview from '../../../components/admin/BrandPreview';
import { toast } from '../../../store/uiStore';
import { cx } from '../../../lib/cx';

const MAX_WELCOME = 120;
const MAX_LOGO_BYTES = 400 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']; // the server refuses SVG (it can carry scripts)

export default function BrandingTab({ business, draft, update }) {
  const b = draft.branding;
  const set = (patch) => update({ branding: { ...b, ...patch } });
  const fileRef = useRef(null);
  const canHide = hasFeature(business.plan, 'removeBranding');

  // Shown straight away as a preview; uploaded to the server (POST /api/business/logo) on Save.
  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return toast('Please pick a PNG, JPG, or WebP image', { tone: 'critical' });
    if (file.size > MAX_LOGO_BYTES) return toast('Logo must be under 400 KB', { tone: 'critical' });
    const reader = new FileReader();
    reader.onload = () => set({ logoDataUrl: reader.result, logoFile: file });
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div>
          <p className="ql-label">Logo</p>
          <div className="flex items-center gap-4">
            <BusinessLogo business={{ ...business, branding: b }} size={64} />
            <div className="flex flex-wrap gap-2">
              <Button icon={Upload} onClick={() => fileRef.current?.click()}>Upload logo</Button>
              {b.logoDataUrl && <Button variant="ghost" icon={Trash2} onClick={() => set({ logoDataUrl: '', logoFile: undefined })}>Remove</Button>}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} aria-label="Logo file" />
          </div>
          <p className="ql-help mt-1.5">Square PNG, JPG, or WebP under 400 KB. Without a logo we show your first letter on your brand colour.</p>
        </div>
        <div>
          <p className="ql-label" id="brand-color-label">Brand colour</p>
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-labelledby="brand-color-label">
            {BRAND_SWATCHES.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={b.brandColor.toLowerCase() === c.toLowerCase()} aria-label={`Colour ${c}`} onClick={() => set({ brandColor: c })} className={cx('flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 transition dark:ring-offset-neutral-900', b.brandColor.toLowerCase() === c.toLowerCase() && 'ring-2 ring-[#303030] dark:ring-white')} style={{ background: c }}>
                {b.brandColor.toLowerCase() === c.toLowerCase() && <Check className="h-4 w-4 text-white" aria-hidden="true" />}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-2 text-[13px]">
              <input type="color" value={b.brandColor} onChange={(e) => set({ brandColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded border border-admin-border bg-transparent" />
              <span className="font-mono">{b.brandColor.toUpperCase()}</span>
            </label>
          </div>
        </div>
        <div>
          <Textarea label="Welcome message" rows={3} maxLength={MAX_WELCOME} value={b.welcomeMessage} onChange={(e) => set({ welcomeMessage: e.target.value })} />
          <p className={cx('ql-help mt-1 text-right', b.welcomeMessage.length >= MAX_WELCOME && 'text-[#8E0B21]')} aria-live="polite">{b.welcomeMessage.length}/{MAX_WELCOME}</p>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-admin-border p-4 dark:border-neutral-700">
          <Toggle className="flex-1" label='Hide "Powered by QueueLess"' help={canHide ? 'Removes our small credit from your public pages.' : 'The Free plan shows a small credit on your public pages. Upgrade to remove it.'} checked={canHide && b.hidePoweredBy} disabled={!canHide} onChange={(v) => set({ hidePoweredBy: v })} />
          {!canHide && <LockBadge plan="Pro" />}
        </div>
      </div>
      <BrandPreview business={business} branding={b} />
    </div>
  );
}
