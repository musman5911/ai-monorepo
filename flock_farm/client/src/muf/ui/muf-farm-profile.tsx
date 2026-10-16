// muf shared farm-profile card — the one-page PDF for buyers.
// The app provides the domain stats (milk / eggs / crops) via buildPdfData;
// the contact form, storage and PDF engine (muf-profile) are shared.
// Renders as a button that opens a popup (DetailModal) with the contact form.
import { useState } from 'react';
import { FileText } from 'lucide-react';
import { downloadFarmProfilePdf, loadProfileContact, saveProfileContact, MufProfileContact, MufProfileOpts } from '../data/muf-profile';
import { mufUr } from '../data/muf-urdu';
import DetailModal from '../core/muf-modal';

interface MufFarmProfileProps {
  /** Current app language. */
  lang: 'en' | 'ur' | 'roman';
  /** App-specific localStorage key for the contact form (dm_/flockfarm_/af_ prefix). */
  storageKey: string;
  /** Domain blurb under the title (English; Urdu from MUF_URDU). */
  blurbEn: string;
  /** Builds the domain stats for the PDF (called on download). */
  buildPdfData: () => Omit<MufProfileOpts, 'contact'>;
}

export default function FarmProfileCard({ lang, storageKey, blurbEn, buildPdfData }: MufFarmProfileProps) {
  const L = (en: string, ur?: string) => (lang === 'ur' ? (ur || mufUr(en)) : en);
  const [contact, setContact] = useState<MufProfileContact>(() => loadProfileContact(storageKey));
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const set = (k: keyof MufProfileContact, v: string) => {
    const c = { ...contact, [k]: v };
    setContact(c);
    saveProfileContact(storageKey, c);
  };

  const download = async () => {
    setBusy(true);
    try {
      await downloadFarmProfilePdf({ ...buildPdfData(), contact });
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-farm-500';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="muf-card-link w-full flex items-center gap-3 p-4 text-left"
      >
        <span className="shrink-0 w-10 h-10 rounded-lg bg-farm-100 dark:bg-farm-900/30 text-farm-600 dark:text-farm-400 flex items-center justify-center">
          <FileText className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{L('Farm profile for buyers (PDF)')}</p>
          <p className="text-[11px] text-slate-400 truncate">{L(blurbEn)}</p>
        </div>
        <span className="shrink-0 text-[10px] font-bold text-farm-600 dark:text-farm-400 uppercase tracking-wider">{L('Open')} →</span>
      </button>

      <DetailModal open={open} onClose={() => setOpen(false)} title={L('Farm profile for buyers (PDF)')} size="small"
        icon={<FileText className="w-5 h-5" />} iconBg="bg-farm-100 text-farm-600 dark:bg-farm-900/30 dark:text-farm-400">
        <div className="space-y-4">
          <p className="text-[11px] text-slate-400">{L(blurbEn)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="muf-pc-label-micro">{L('Phone')}</label>
              <input className={inputClass} value={contact.phone} onChange={e => set('phone', e.target.value)} placeholder="0300-1234567" />
            </div>
            <div>
              <label className="muf-pc-label-micro">{L('WhatsApp')}</label>
              <input className={inputClass} value={contact.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="0300-1234567" />
            </div>
            <div>
              <label className="muf-pc-label-micro">{L('Farm address')}</label>
              <input className={inputClass} value={contact.address} onChange={e => set('address', e.target.value)} placeholder={L('Village / city')} />
            </div>
          </div>
          <button
            onClick={download}
            disabled={busy}
            className="w-full px-4 py-2.5 bg-farm-600 hover:bg-farm-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition"
          >{busy ? L('Preparing…') : L('Download farm profile (PDF)')}</button>
        </div>
      </DetailModal>
    </>
  );
}
