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
    try { config = JSON.parse(localStorage.getItem('af_myfarms' ) || '{}'); } catch { config = {}; }
    const destinations: Record<'agri' | 'dairy' | 'flock', string | undefined> = {
      agri: window.location.origin,
      dairy: config.urls?.[0],
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
    <div className="w-full min-w-0 px-1 py-2 sm:px-2 lg:px-2 space-y-3 mx-0 muf-superadmin-page">
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
