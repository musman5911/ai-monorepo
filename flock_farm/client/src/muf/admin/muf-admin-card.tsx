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
    <div className={`muf-admin-card overflow-hidden transition-colors ${className}`}>
      <div className="muf-admin-card-head">
        {icon && (
          <span className="muf-admin-card-icon">{icon}</span>
        )}
        <div className="min-w-0">
          <h3 className="muf-admin-card-title truncate">{title}</h3>
          {subtitle && (
            <p className="muf-admin-card-subtitle truncate">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="muf-admin-card-body">
        {children}
      </div>
    </div>
  );
}
