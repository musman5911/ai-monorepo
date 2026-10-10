// muf-admin-card — shared card wrapper for admin popup tabs.
// Gives every admin section the same visual language: header strip with
// icon + title, body with consistent padding. Used by General, Users,
// Reports, Backup, Telegram tabs across all 3 farm apps.
//
// TWIN FILES (all 3 apps, byte-identical .tsx):
//   dairy_farm/client/src/muf-admin-card.tsx
//   flock_farm/client/src/muf-admin-card.tsx
//   agri_farm/frontend/src/muf-admin-card.tsx
import React from 'react';

interface MufAdminCardProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export default function MufAdminCard({
  icon, title, subtitle, children, className = '',
}: MufAdminCardProps) {
  return (
    <div className={`muf-admin-card bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl overflow-hidden shadow-sm shadow-slate-900/[0.04] dark:shadow-black/20 transition-colors ${className}`}>
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700/80 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900/70">
        {icon && (
          <span className="text-farm-600 dark:text-emerald-400 shrink-0 rounded-xl bg-farm-50 dark:bg-emerald-950/40 p-2">{icon}</span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-slate-50 truncate">{title}</h3>
          {subtitle && (
            <p className="text-xs leading-snug text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="p-4 sm:p-5 space-y-1">
        {children}
      </div>
    </div>
  );
}
