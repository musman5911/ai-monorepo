// muf-admin-reports — shared Reports tab content for all 3 farm apps.
// Renders: optional summary sharing card + report buttons grid + ExportCenter slot.
// Each app passes its own report buttons and ExportCenter as children.
//
// TWIN FILES (all 3 apps, byte-identical .tsx):
//   dairy_farm/client/src/muf-admin-reports.tsx
//   flock_farm/client/src/muf-admin-reports.tsx
//   agri_farm/frontend/src/muf-admin-reports.tsx
import React from 'react';
import { FileText, MessageCircle, Mail, Loader2 } from 'lucide-react';
import MufAdminCard from './muf-admin-card';
import { L } from '../../i18n';

export interface MufReportButton {
  label: string;
  onClick: () => void;
  light?: boolean;
}

interface MufAdminReportsProps {
  // Summary sharing (optional — apps without this just skip the card)
  summaryDateStr?: string;
  summaryText?: string;
  summaryLoading?: boolean;
  summaryLoadErr?: boolean;
  summaryMsg?: { type: 'ok' | 'err'; text: string } | null;
  onShareWhatsApp?: () => void;
  onSendEmail?: () => void;
  sendingEmail?: boolean;

  // Report buttons (per-app: egg/milk/crop reports)
  reportButtons: MufReportButton[];

  // ExportCenter (passed as children so each app can wire its own)
  children?: React.ReactNode;
}

function ReportBtn({ onClick, label, light }: { onClick: () => void; label: string; light?: boolean }) {
  return (
    <button onClick={onClick}
      className={`flex items-center justify-center gap-2 px-4 py-2.5 font-semibold text-xs rounded-xl transition cursor-pointer ${
        light
          ? 'bg-white dark:bg-slate-800 hover:bg-farm-50 dark:hover:bg-slate-700 border border-farm-200 dark:border-farm-800 text-farm-700 dark:text-farm-300'
          : 'bg-farm-600 hover:bg-farm-700 text-white'
      }`}>
      <FileText className="w-4 h-4" /> {label}
    </button>
  );
}

export default function MufAdminReports({
  summaryDateStr, summaryText, summaryLoading, summaryLoadErr, summaryMsg,
  onShareWhatsApp, onSendEmail, sendingEmail,
  reportButtons, children,
}: MufAdminReportsProps) {
  const hasSummary = !!onShareWhatsApp || !!onSendEmail;

  return (
    <div className="space-y-6">
      {/* ── Share Today's Summary (optional) ── */}
      {hasSummary && (
        <MufAdminCard icon={<FileText className="w-5 h-5" />} title={L('Share Today\'s Summary')} subtitle={L('Farm stats, alerts — send it out in one tap')}>
          <div className="space-y-3">
            {summaryDateStr && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">{L('Today\'s farm snapshot')}</span>
                <span className="text-3xs font-mono text-slate-400 shrink-0">{summaryDateStr}</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {onShareWhatsApp && (
                <button onClick={onShareWhatsApp} disabled={!summaryText}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[color:var(--muf-brand-whatsapp)] hover:bg-[color:var(--muf-brand-whatsapp-hover)] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition cursor-pointer">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </button>
              )}
              {onSendEmail && (
                <button onClick={onSendEmail} disabled={sendingEmail}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-bold shadow-sm transition cursor-pointer">
                  {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Email list
                </button>
              )}
            </div>

            {summaryMsg && (
              <div className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                summaryMsg.type === 'ok'
                  ? 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-100 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              }`}>
                {summaryMsg.text}
              </div>
            )}

            {summaryLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading summary...
              </div>
            ) : summaryLoadErr ? (
              <p className="text-xs text-rose-500">{L('Couldn\'t load today\'s summary from the server.')}</p>
            ) : summaryText ? (
              <pre className="max-h-56 overflow-auto text-[11px] leading-relaxed font-mono bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
{summaryText}
              </pre>
            ) : null}
          </div>
        </MufAdminCard>
      )}

      {/* ── Export Reports ── */}
      {reportButtons.length > 0 && (
        <MufAdminCard icon={<FileText className="w-5 h-5" />} title={L('Export Reports')} subtitle={L('Download PDF or CSV reports of your farm data')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {reportButtons.map((btn, i) => (
              <ReportBtn key={i} onClick={btn.onClick} label={btn.label} light={btn.light} />
            ))}
          </div>
        </MufAdminCard>
      )}

      {/* ── Export Center (app-specific) ── */}
      {children && (
        <MufAdminCard icon={<FileText className="w-5 h-5" />} title={L('Export Center')} subtitle={L('Full data export tools')}>
          {children}
        </MufAdminCard>
      )}
    </div>
  );
}
