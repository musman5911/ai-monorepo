import React, { useEffect, useState } from 'react';
import { SuperAdminView } from './SuperAdminView';
import { QrWaybillModal, WaybillData } from './QrWaybillModal';

export const SuperAdminTab: React.FC = () => {
  const [isWaybillOpen, setIsWaybillOpen] = useState(false);
  const [waybills, setWaybills] = useState<WaybillData[]>(() => {
    try {
      const saved = localStorage.getItem('muf_superadmin_waybills_v1');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem('muf_superadmin_waybills_v1', JSON.stringify(waybills)); } catch { /* storage may be disabled */ }
  }, [waybills]);

  const navigateToFarm = (farm: 'agri' | 'dairy' | 'flock') => {
    let config: { urls?: string[] } = {};
    try { config = JSON.parse(localStorage.getItem('dm_myfarms' ) || '{}'); } catch { config = {}; }
    const destinations: Record<'agri' | 'dairy' | 'flock', string | undefined> = {
      agri: config.urls?.[0],
      dairy: window.location.origin,
      flock: config.urls?.[1],
    };
    const destination = destinations[farm]?.trim();
    if (!destination) return;
    try {
      const url = new URL(destination, window.location.origin);
      if (url.protocol === 'http:' || url.protocol === 'https:') window.location.assign(url.toString());
    } catch { /* invalid/unconfigured farm URL: stay on this page */ }
  };

  return (
    <div className="p-3 sm:p-4 lg:p-5 space-y-5 max-w-[1480px] mx-auto muf-superadmin-page">
      <SuperAdminView
        highContrast={false}
        onNavigateFarm={navigateToFarm}
        waybills={waybills}
        onOpenWaybill={() => setIsWaybillOpen(true)}
      />

      <QrWaybillModal
        isOpen={isWaybillOpen}
        onClose={() => setIsWaybillOpen(false)}
        onAcceptWaybill={(newWb) => setWaybills((prev) => [newWb, ...prev])}
        activeFarm="super_admin"
      />
    </div>
  );
};
