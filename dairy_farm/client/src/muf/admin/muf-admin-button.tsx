// muf-admin-button — shared button component for admin popup tabs.
// Variants: primary (farm green), secondary (slate), danger (red), success (emerald).
// Consistent sizing, padding, rounding across all 3 farm apps.
import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
type Size = 'sm' | 'md';

interface MufAdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-farm-600 hover:bg-farm-700 active:bg-farm-800 text-white shadow-sm shadow-farm-900/10',
  secondary: 'bg-white hover:bg-slate-50 active:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 dark:active:bg-slate-600 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-sm',
  danger: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm shadow-rose-900/10',
  success: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm shadow-emerald-900/10',
  warning: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-sm',
};

const sizeClasses: Record<Size, string> = {
  sm: 'min-h-9 px-3.5 py-2 text-xs gap-2',
  md: 'min-h-10 px-4 py-2.5 text-sm gap-2.5',
};

export default function MufAdminButton({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  ...props
}: MufAdminButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-bold rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed active:translate-y-px ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
