// muf-notifications — shared browser notification helper.
// Requests permission and fires desktop notifications for important farm events.
// No push server needed — works while the app is open in the browser.
//
// TWIN FILES:
//   dairy_farm/client/src/muf-notifications.ts  (this file)
//   flock_farm/client/src/muf-notifications.ts  (byte-identical twin)
//   agri_farm/frontend/src/muf-notifications.ts (byte-identical twin)

const PREFS_KEY = 'muf_notif_prefs';

export interface MufNotifPrefs {
  enabled: boolean;
  healthAlerts: boolean;
  lowFeed: boolean;
  productionDrop: boolean;
  financialDeficit: boolean;
}

const DEFAULT_PREFS: MufNotifPrefs = {
  enabled: false,
  healthAlerts: true,
  lowFeed: true,
  productionDrop: true,
  financialDeficit: false,
};

export function loadNotifPrefs(): MufNotifPrefs {
  try {
    const stored = JSON.parse(localStorage.getItem(PREFS_KEY) || '');
    return { ...DEFAULT_PREFS, ...stored };
  } catch { return { ...DEFAULT_PREFS }; }
}

export function saveNotifPrefs(prefs: MufNotifPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function notifPermission(): NotificationPermission {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission;
}

export async function requestNotifPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

/** Fire a browser notification if permission is granted and prefs allow it. */
export function fireNotif(title: string, body: string, prefs: MufNotifPrefs, category: keyof Omit<MufNotifPrefs, 'enabled'>): void {
  if (!prefs.enabled || !prefs[category]) return;
  if (notifPermission() !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/logo.png',
      badge: '/favicon.png',
      tag: `muf-${category}-${Date.now()}`,
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 8000);
  } catch { /* notifications not available */ }
}
