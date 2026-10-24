import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Building2, ChevronDown, Plus, RotateCcw, Save, Settings, Users } from 'lucide-react';
import { L } from '../../i18n';

type Farm = { _id: string; name: string; location?: string; archived?: boolean };
type FarmUser = { _id: string; username: string; displayName?: string; email?: string; role?: string; farmRole?: string; farmIds?: string[] };
type AppKey = 'agri' | 'dairy' | 'flock';

const CONFIG: Record<AppKey, { tokenKey: string; selectedKey: string; profilePath: string; usersPath: string; userPath: (id: string) => string }> = {
  agri: { tokenKey: 'token', selectedKey: 'muf_active_farm_agri', profilePath: '/users/me', usersPath: '/users', userPath: (id) => `/users/${encodeURIComponent(id)}/edit` },
  dairy: { tokenKey: 'dm_token', selectedKey: 'muf_active_farm_dairy', profilePath: '/auth/me', usersPath: '/auth/users', userPath: (id) => `/auth/users/${encodeURIComponent(id)}` },
  flock: { tokenKey: 'flockfarm_token', selectedKey: 'muf_active_farm_flock', profilePath: '/auth/me', usersPath: '/auth/users', userPath: (id) => `/auth/users/${encodeURIComponent(id)}` },
};

function apiRoot(): string {
  const configured = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
  return configured.endsWith('/api') ? configured : `${configured}/api`;
}
function roleOf(user: FarmUser | null | undefined): string {
  const role = String(user?.farmRole || user?.role || 'worker').toLowerCase();
  return role === 'admin' ? 'owner' : role;
}
function readToken(key: string): string {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

export default function MufFarmSwitcher({ app }: { app: AppKey }) {
  const config = CONFIG[app];
  const [farms, setFarms] = useState<Farm[]>([]);
  const [activeFarmId, setActiveFarmId] = useState('');
  const [farmRole, setFarmRole] = useState('worker');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [users, setUsers] = useState<FarmUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assignmentRole, setAssignmentRole] = useState('worker');
  const [assignmentFarmIds, setAssignmentFarmIds] = useState<string[]>([]);
  const [adminPassword, setAdminPassword] = useState('');
  const [newFarmName, setNewFarmName] = useState('');
  const [newFarmLocation, setNewFarmLocation] = useState('');
  const [drafts, setDrafts] = useState<Record<string, { name: string; location: string }>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const request = useCallback(async (path: string, init: RequestInit = {}, includeFarm = true) => {
    const token = readToken(config.tokenKey);
    const selected = (() => { try { return localStorage.getItem(config.selectedKey) || ''; } catch { return ''; } })();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}`, 'X-Access-Token': token, 'X-Auth-Token': token } : {}),
      ...(includeFarm && selected ? { 'X-Farm-Id': selected } : {}),
      ...((init.headers || {}) as Record<string, string>),
    };
    const response = await fetch(`${apiRoot()}${path}`, { ...init, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.detail || body.message || `Request failed (${response.status})`);
    return body;
  }, [config]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const profileResponse = await request(config.profilePath, {}, false);
      const profile = profileResponse.user || profileResponse;
      const normalizedRole = roleOf(profile);
      setFarmRole(normalizedRole);
      let result: any;
      try {
        result = await request('/farms');
      } catch (firstError) {
        try {
          localStorage.removeItem(config.selectedKey);
          result = await request('/farms', {}, false);
        } catch {
          throw firstError;
        }
      }
      const nextFarms: Farm[] = Array.isArray(result.farms) ? result.farms : [];
      setFarms(nextFarms);
      const saved = (() => { try { return localStorage.getItem(config.selectedKey) || ''; } catch { return ''; } })();
      const validSaved = normalizedRole === 'owner' && saved === 'all' ? 'all' : nextFarms.some((farm) => farm._id === saved && !farm.archived) ? saved : '';
      const nextId = validSaved || result.activeFarmId || nextFarms.find((farm) => !farm.archived)?._id || nextFarms[0]?._id || '';
      setActiveFarmId(nextId);
      if (nextId) { try { localStorage.setItem(config.selectedKey, nextId); } catch { /* storage may be unavailable */ } }
      setDrafts(Object.fromEntries(nextFarms.map((farm) => [farm._id, { name: farm.name, location: farm.location || '' }])));
    } catch (e) {
      setError(e instanceof Error ? e.message : L('Could not load farms'));
    } finally {
      setLoading(false);
    }
  }, [config, request]);

  useEffect(() => { void load(); }, [load]);

  const activeFarm = useMemo(() => farms.find((farm) => farm._id === activeFarmId), [farms, activeFarmId]);
  const isReadOnlyAll = farmRole === 'owner' && activeFarmId === 'all';

  const selectFarm = (id: string) => {
    if (!id || id === activeFarmId) { setOpen(false); return; }
    try { localStorage.setItem(config.selectedKey, id); } catch { /* storage may be unavailable */ }
    setActiveFarmId(id);
    setOpen(false);
    window.location.reload();
  };

  const loadUsers = async () => {
    setError('');
    try {
      const result = await request(config.usersPath, {}, false);
      const rows = Array.isArray(result) ? result : Array.isArray(result.users) ? result.users : Array.isArray(result.data) ? result.data : [];
      setUsers(rows);
      if (rows.length && !selectedUserId) {
        const first = rows[0];
        setSelectedUserId(first._id);
        setAssignmentRole(roleOf(first));
        setAssignmentFarmIds((first.farmIds || []).map(String));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : L('Could not load users'));
    }
  };

  const openManage = async () => {
    setManageOpen((value) => !value);
    if (!manageOpen && farmRole === 'owner') await loadUsers();
  };

  const selectedUser = users.find((user) => user._id === selectedUserId);
  const chooseUser = (id: string) => {
    setSelectedUserId(id);
    const user = users.find((item) => item._id === id);
    if (user) {
      setAssignmentRole(roleOf(user));
      setAssignmentFarmIds((user.farmIds || []).map(String));
    }
    setAdminPassword('');
  };

  const createFarm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newFarmName.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await request('/farms', { method: 'POST', body: JSON.stringify({ name: newFarmName.trim(), location: newFarmLocation.trim() }) }, false);
      setNewFarmName(''); setNewFarmLocation('');
      await load();
      if (result?._id) selectFarm(String(result._id));
      setNotice(L('Farm created'));
    } catch (e) { setError(e instanceof Error ? e.message : L('Could not create farm')); }
    finally { setBusy(false); }
  };

  const saveFarm = async (farm: Farm) => {
    const draft = drafts[farm._id];
    if (!draft?.name.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/farms/${encodeURIComponent(farm._id)}`, { method: 'PUT', body: JSON.stringify({ name: draft.name.trim(), location: draft.location.trim() }) }, false);
      await load(); setNotice(L('Farm details saved'));
    } catch (e) { setError(e instanceof Error ? e.message : L('Could not save farm')); }
    finally { setBusy(false); }
  };

  const setArchived = async (farm: Farm) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/farms/${encodeURIComponent(farm._id)}/${farm.archived ? 'restore' : 'archive'}`, { method: 'POST', body: JSON.stringify({}) }, false);
      await load(); setNotice(farm.archived ? L('Farm restored') : L('Farm archived'));
    } catch (e) { setError(e instanceof Error ? e.message : L('Could not update farm')); }
    finally { setBusy(false); }
  };

  const saveAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser || !adminPassword) { setError(L('Enter your current password to confirm this change')); return; }
    if (assignmentRole !== 'owner' && assignmentFarmIds.length === 0) { setError(L('Assign at least one farm')); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await request(config.userPath(selectedUser._id), {
        method: 'PATCH',
        body: JSON.stringify({ role: assignmentRole, farmIds: assignmentRole === 'owner' ? [] : assignmentFarmIds, adminPassword }),
      }, false);
      setAdminPassword('');
      await loadUsers();
      setNotice(L('User access updated'));
    } catch (e) { setError(e instanceof Error ? e.message : L('Could not update user access')); }
    finally { setBusy(false); }
  };

  if (loading && farms.length === 0) return <span className="muf-farm-switcher-status">{L('Loading farms…')}</span>;

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative">
        <button type="button" className="muf-icon-button !w-auto !max-w-[190px] !px-3 flex items-center gap-2" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={L('Choose active farm')}>
          <Building2 size={16} />
          <span className="truncate text-xs font-semibold">{isReadOnlyAll ? L('All farms · read only') : activeFarm?.name || L('Select farm')}</span>
          <ChevronDown size={14} />
        </button>
        {open && <div className="absolute right-0 top-full mt-2 z-[1700] w-64 max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl">
          {farmRole === 'owner' && <button type="button" onClick={() => selectFarm('all')} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${isReadOnlyAll ? 'bg-amber-50 dark:bg-amber-900/30 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{L('All farms · read only')}</button>}{farms.filter((farm) => !farm.archived).map((farm) => <button key={farm._id} type="button" onClick={() => selectFarm(farm._id)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${farm._id === activeFarmId ? 'bg-emerald-50 dark:bg-emerald-900/30 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{farm.name}</button>)}
          {farmRole === 'owner' && <button type="button" onClick={() => { setOpen(false); void openManage(); }} className="mt-2 w-full border-t border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2"><Settings size={15} />{L('Manage farms & access')}</button>}
        </div>}
      </div>

      {isReadOnlyAll && <span role="status" className="sr-only">{L('All farms is read-only. Select one farm to make changes.')}</span>}
      {manageOpen && farmRole === 'owner' && <div className="fixed inset-0 z-[1800] flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setManageOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="muf-farm-manager-title" className="mt-8 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-2xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="muf-farm-manager-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">{L('Farms & access')}</h2>
            <button type="button" onClick={() => setManageOpen(false)} className="muf-icon-button" aria-label={L('Close')}>×</button>
          </div>
          {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
          {notice && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{notice}</p>}
          <form onSubmit={createFarm} className="mb-5 grid grid-cols-1 gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3 sm:grid-cols-[1fr_1fr_auto]">
            <input value={newFarmName} onChange={(e) => setNewFarmName(e.target.value)} placeholder={L('New farm name')} aria-label={L('New farm name')} required className="min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
            <input value={newFarmLocation} onChange={(e) => setNewFarmLocation(e.target.value)} placeholder={L('Location (optional)')} aria-label={L('Location (optional)')} className="min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
            <button disabled={busy} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus size={15} className="mr-1 inline" />{L('Add farm')}</button>
          </form>
          <div className="mb-6 space-y-2">
            {farms.map((farm) => <div key={farm._id} className="grid grid-cols-1 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
              <input value={drafts[farm._id]?.name ?? farm.name} onChange={(e) => setDrafts((prev) => ({ ...prev, [farm._id]: { name: e.target.value, location: prev[farm._id]?.location || farm.location || '' } }))} aria-label={L('Farm name')} className="min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
              <input value={drafts[farm._id]?.location ?? farm.location ?? ''} onChange={(e) => setDrafts((prev) => ({ ...prev, [farm._id]: { name: prev[farm._id]?.name || farm.name, location: e.target.value } }))} aria-label={L('Farm location')} placeholder={L('Location')} className="min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
              <button type="button" disabled={busy} onClick={() => void saveFarm(farm)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm disabled:opacity-50"><Save size={14} className="mr-1 inline" />{L('Save')}</button>
              <button type="button" disabled={busy} onClick={() => void setArchived(farm)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm disabled:opacity-50">{farm.archived ? <RotateCcw size={14} className="mr-1 inline" /> : <Archive size={14} className="mr-1 inline" />}{farm.archived ? L('Restore') : L('Archive')}</button>
            </div>)}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <h3 className="mb-3 flex items-center gap-2 font-semibold"><Users size={16} />{L('User roles and farm assignments')}</h3>
            <form onSubmit={saveAssignment} className="space-y-3">
              <select value={selectedUserId} onChange={(e) => chooseUser(e.target.value)} aria-label={L('Select user')} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
                {users.map((user) => <option key={user._id} value={user._id}>{user.displayName || user.username} · {roleOf(user)}</option>)}
              </select>
              {selectedUser && <>
                <label className="block text-sm">{L('Role')}
                  <select value={assignmentRole} onChange={(e) => setAssignmentRole(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
                    <option value="owner">{L('Owner')}</option><option value="manager">{L('Manager')}</option><option value="worker">{L('Worker')}</option>
                  </select>
                </label>
                {assignmentRole !== 'owner' && <fieldset className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <legend className="px-1 text-sm font-semibold">{L('Assigned farms')}</legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{farms.filter((farm) => !farm.archived).map((farm) => <label key={farm._id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={assignmentFarmIds.includes(farm._id)} onChange={(e) => setAssignmentFarmIds((prev) => e.target.checked ? [...new Set([...prev, farm._id])] : prev.filter((id) => id !== farm._id))} />
                    <span>{farm.name}</span>
                  </label>)}</div>
                </fieldset>}
                <label className="block text-sm">{L('Your current password to confirm')}
                  <input type="password" autoComplete="current-password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
                </label>
                <button disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? L('Saving…') : L('Save access')}</button>
              </>}
            </form>
          </div>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{L('Archiving hides a farm from normal selection. Deletion is intentionally not offered here.')}</p>
        </section>
      </div>}
      {error && !manageOpen && <span role="status" className="sr-only">{error}</span>}
    </div>
  );
}
