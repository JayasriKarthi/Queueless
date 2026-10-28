import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Download, Printer, Tv, ExternalLink, Globe, Code2, Tablet, AlertTriangle } from 'lucide-react';
import { useTenant } from '../../hooks/useTenant';
import { useFeature } from '../../hooks/useFeature';
import { setQueueOpen, markSetup } from '../../lib/fakeBackend';
import { copyText, publicUrl, downloadDataUrl } from '../../lib/formatters';
import { toast } from '../../store/uiStore';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Toggle from '../../components/ui/Toggle';
import Badge from '../../components/ui/Badge';
import Banner from '../../components/ui/Banner';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import LockedFeature from '../../components/ui/LockedFeature';
import GoLiveChecklist from '../../components/admin/GoLiveChecklist';
import QrPoster from '../../components/admin/QrPoster';

function CopyField({ value, label }) {
  return (
    <div>
      <p className="ql-label">{label}</p>
      <div className="flex gap-2">
        <input readOnly value={value} className="ql-input bg-[#F7F7F7] font-mono text-xs dark:bg-neutral-800" aria-label={label} onFocus={(e) => e.target.select()} />
        <Button icon={Copy} onClick={async () => toast((await copyText(value)) ? 'Copied' : 'Could not copy')}>Copy</Button>
      </div>
    </div>
  );
}

export default function Channels() {
  const { business } = useTenant();
  const tv = useFeature('tvDisplay');
  const domain = useFeature('customDomain');
  const qrRef = useRef(null);
  const [poster, setPoster] = useState(false);
  const joinUrl = publicUrl(`/${business.slug}`);
  const displayUrl = publicUrl(`/display/${business.slug}`);
  const live = business.isLive;

  const downloadPng = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    downloadDataUrl(`${business.slug}-qr.png`, canvas.toDataURL('image/png'));
    markSetup(business.id, 'qrPrinted');
    toast('QR code downloaded');
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Channels" subtitle="How customers reach your queue" badge={live ? <Badge tone="success" dot>Live</Badge> : <Badge tone="attention" dot>Not live</Badge>} />

      <Card title="Join link and QR code">
        <div className="relative">
          <div className={live ? '' : 'pointer-events-none select-none blur-[6px] opacity-60'} aria-hidden={!live}>
            <div className="grid gap-6 md:grid-cols-[auto_1fr]">
              <div ref={qrRef} className="mx-auto rounded-xl border border-admin-border bg-white p-3 dark:border-neutral-700">
                <QRCodeCanvas value={joinUrl} size={168} level="M" marginSize={1} />
              </div>
              <div className="space-y-4">
                <CopyField label="Join link" value={joinUrl} />
                <div className="flex flex-wrap gap-2">
                  <Button icon={Download} onClick={downloadPng}>Download PNG</Button>
                  <Button icon={Printer} onClick={() => setPoster(true)}>A4 poster</Button>
                  <Button icon={ExternalLink} href={`/${business.slug}`} target="_blank" rel="noopener">Open join page</Button>
                </div>
                <p className="flex items-center gap-1.5 text-[13px] text-[#8A6100] dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Changing your link will break printed QR codes.
                </p>
              </div>
            </div>
          </div>
          {!live && (
            <div className="absolute inset-0 flex items-center justify-center p-2">
              <div className="w-full max-w-sm rounded-xl border border-admin-border bg-white p-4 shadow-pop dark:border-neutral-700 dark:bg-neutral-900">
                <GoLiveChecklist business={business} />
              </div>
            </div>
          )}
        </div>
      </Card>

      {live && (
        <Card title="Queue status">
          <Toggle
            size="lg"
            label="Pause queue (close for now)"
            help={business.isOpen ? 'Customers can join right now.' : 'Public pages show "Closed". People already waiting are still served.'}
            checked={!business.isOpen}
            onChange={async (paused) => {
              const res = await setQueueOpen(business.id, !paused);
              toast(res.ok ? (paused ? 'Queue paused' : 'Queue reopened') : res.error, { tone: res.ok ? 'default' : 'critical' });
            }}
          />
        </Card>
      )}

      <Card title="Waiting-room TV display" subtitle="Open this link on any smart TV or a laptop connected to a screen">
        <LockedFeature feature="tvDisplay" title="TV display is on paid plans" description="Show now serving, next in line, and a join QR on a big screen.">
          <div className="space-y-3">
            <CopyField label="Display link" value={displayUrl} />
            <Button variant="primary" icon={Tv} href={`/display/${business.slug}`} target="_blank" rel="noopener" disabled={!live}>Launch display</Button>
            {!live && <p className="ql-subdued">Available after you go live.</p>}
          </div>
        </LockedFeature>
        {!tv.enabled && <p className="ql-subdued mt-2">Preview: /display/{business.slug}</p>}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Website widget" subtitle="Placeholder">
          <div className="flex gap-3">
            <Code2 className="h-5 w-5 shrink-0 text-admin-muted" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="ql-subdued">Add a "Join the line" button to your website. Coming soon.</p>
              <pre className="mt-2 relative overflow-x-auto rounded-lg bg-[#1A1A1A] p-3 text-[11px] text-white/80">{`<a href="${joinUrl}"\n   class="queueless-button">Join the line</a>`}</pre>
            </div>
          </div>
        </Card>
        <Card title="Self-service kiosk" subtitle="Placeholder">
          <div className="flex gap-3">
            <Tablet className="h-5 w-5 shrink-0 text-admin-muted" aria-hidden="true" />
            <p className="ql-subdued">Put a tablet at your entrance for customers without a phone. Kiosk mode is coming soon.</p>
          </div>
        </Card>
      </div>

      <Card title="Use your own domain" subtitle="Enterprise">
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-[#F7F7F7] p-3 text-[13px] dark:bg-neutral-800">
            <Globe className="h-4 w-4 text-admin-muted" aria-hidden="true" />
            <span>Subdomain preview:</span>
            <span className="font-mono">{business.slug}.queueless.app</span>
          </div>
          {domain.enabled ? (
            <Input label="Custom domain" placeholder="queue.yourbusiness.com" help="Placeholder only. DNS setup is not part of this demo." />
          ) : (
            <LockedFeature feature="customDomain" compact title="Custom domains are on the Enterprise plan" />
          )}
        </div>
      </Card>

      {!live && <Banner tone="info">Before go live, your public pages show "This queue is not open yet".</Banner>}

      <Modal
        open={poster}
        onClose={() => setPoster(false)}
        title="A4 poster"
        size="md"
        footer={<><Button onClick={() => setPoster(false)}>Close</Button><Button variant="primary" icon={Printer} onClick={() => { markSetup(business.id, 'qrPrinted'); window.print(); }}>Print poster</Button></>}
      >
        <QrPoster business={business} />
      </Modal>
    </div>
  );
}
