import { useEffect, useState } from 'react';
import { QrCode, ExternalLink, Share2, Copy } from 'lucide-react';
import QRCode from 'qrcode';
import DetailModal from './muf-modal';

/* muf-card-qr — QR card share popup (byte-identical in all three frontends).
   Shows the public card URL (QR + link) for any entity — worker / buyer /
   supplier / customer. The card PAGE itself is rendered by the backend
   muf-card.mjs twin (no login, bilingual). Keep in sync with the twins. */

const KIND_TITLES = {
  worker: 'Worker Card',
  buyer: 'Buyer Card',
  supplier: 'Supplier Card',
  customer: 'Customer Card',
};

interface MufCardQrProps {
  open: boolean;
  onClose: () => void;
  kind: 'worker' | 'buyer' | 'supplier' | 'customer';
  id?: string | number;
  name?: string;
}

export default function MufCardQr({ open, onClose, kind, id, name }: MufCardQrProps) {
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const url = id != null ? `${window.location.origin}/api/cards/${kind}/${id}` : '';
  const kindTitle = KIND_TITLES[kind] || 'Card';

  useEffect(() => {
    if (!open || !url) return;
    setQr('');
    setCopied(false);
    QRCode.toDataURL(url, { width: 240, margin: 1, color: { dark: '#14532d', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [open, url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — user can long-press the link */ }
  }

  function shareWa() {
    const msg = encodeURIComponent(`${name || 'Card'} — ${kindTitle}\n${url}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  const btn = 'flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-60';

  return (
    <DetailModal
      open={open}
      onClose={onClose}
      size="small"
      title={`${name || 'Card'} — QR`}
      subtitle={kindTitle}
      icon={<QrCode className="w-5 h-5 text-white" />}
      iconBg="bg-gradient-to-br from-emerald-500 to-emerald-700"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="bg-white border border-slate-200 dark:border-slate-700 rounded-2xl p-3">
          {qr ? (
            <img src={qr} alt={`${name} QR`} className="w-52 h-52" />
          ) : (
            <div className="w-52 h-52 flex items-center justify-center text-xs text-slate-400">Loading QR…</div>
          )}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center max-w-[19rem]">
          Scan or open this link on the person's phone — the card shows their
          details without a login. Anyone with the link can see it.
        </p>
        <p className="text-[10px] font-mono text-slate-400 break-all text-center max-w-[19rem]">{url}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
          <a href={url} target="_blank" rel="noreferrer" className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white`}>
            <ExternalLink className="w-3.5 h-3.5" /> Open card
          </a>
          <button onClick={shareWa} className={`${btn} bg-[#25D366] hover:bg-[#1ebe5b] text-white`}>
            <Share2 className="w-3.5 h-3.5" /> WhatsApp
          </button>
          <button onClick={copy} className={`${btn} bg-slate-700 hover:bg-slate-800 text-white`}>
            <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied ✓' : 'Copy link'}
          </button>
        </div>
      </div>
    </DetailModal>
  );
}
