import { QRCodeSVG } from 'qrcode.react';
import BusinessLogo from '../ui/BusinessLogo';
import { contrastText } from '../../config/theme';
import { publicUrl } from '../../lib/formatters';

// Printable A4 poster in the business's brand colour (210 × 297 ratio).
export default function QrPoster({ business, className = '' }) {
  const color = business.branding.brandColor;
  const fg = contrastText(color);
  const url = publicUrl(`/${business.slug}`);
  return (
    <div className={`print-area mx-auto flex aspect-[210/297] w-full max-w-[420px] flex-col items-center overflow-hidden bg-white text-center text-[#1A1A1A] shadow-pop ${className}`}>
      <div className="flex w-full flex-col items-center gap-3 px-6 pb-10 pt-8" style={{ background: color, color: fg }}>
        <BusinessLogo business={business} size={56} className="ring-4 ring-white/30" />
        <p className="text-2xl font-medium leading-tight">{business.name}</p>
      </div>
      <div className="-mt-6 rounded-2xl bg-white p-4 shadow-pop">
        <QRCodeSVG value={url} size={180} fgColor="#0B1F1C" level="M" />
      </div>
      <p className="mt-6 px-6 text-[26px] font-medium leading-tight">Scan to join the line</p>
      <p className="mt-2 px-8 text-sm text-black/60">No app needed. See your place in line and get alerted when it is almost your turn.</p>
      <p className="mt-auto w-full break-all border-t border-black/10 px-4 py-3 text-xs text-black/50">{url.replace(/^https?:\/\//, '')}</p>
    </div>
  );
}
