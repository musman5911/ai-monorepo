// muf-admin-field — shared form field for admin popup tabs.
// Renders a label + input (or select/textarea) with consistent styling.
import React from 'react';

interface MufAdminFieldProps {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}

export default function MufAdminField({
  label, children, hint, className = '',
}: MufAdminFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-xs font-bold tracking-wide text-slate-700 dark:text-slate-200">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{hint}</p>
      )}
    </div>
  );
}

// Shared input class for text inputs inside admin tabs
export const adminInputClass = 'w-full min-h-10 px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-farm-500 focus:ring-4 focus:ring-farm-500/10 transition-colors text-slate-800 dark:text-slate-100 placeholder:text-slate-400 shadow-sm shadow-slate-900/[0.02]';
