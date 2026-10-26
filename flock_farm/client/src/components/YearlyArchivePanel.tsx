import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Download, Eye, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import MufAdminCard from '../muf/admin/muf-admin-card';
import { L } from '../i18n';

type ArchiveFarm = { _id: string; id?: string; name: string };
type ArchiveJob = {
  _id: string; id?: string; farmId: string; collection: string; retentionYears: number;
  cutoffDate: string; state: string; sourceCount: number; exportDownloaded?: boolean;
  createdAt?: string; updatedAt?: string;
};
type ArchiveRecord = Record<string, unknown>;
type CollectionOption = { value: string; label: string };
type Props = {
  isOwner: boolean;
  apiBase: string;
  collections: CollectionOption[];
  getHeaders: () => Record<string, string>;
};

const fieldClass = 'w-full min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100';
const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50';

export default function YearlyArchivePanel({ isOwner, apiBase, collections, getHeaders }: Props) {
  const [farms, setFarms] = useState<ArchiveFarm[]>([]);
  const [farmId, setFarmId] = useState('');
  const [collection, setCollection] = useState(collections[0]?.value || '');
  const [retentionYears, setRetentionYears] = useState('5');
  const [jobs, setJobs] = useState<ArchiveJob[]>([]);
  const [prepared, setPrepared] = useState<ArchiveJob | null>(null);
  const [confirmFarmName, setConfirmFarmName] = useState('');
  const [confirmJobId, setConfirmJobId] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<ArchiveJob | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [reportJobId, setReportJobId] = useState('');
  const [reportRecords, setReportRecords] = useState<ArchiveRecord[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const base = apiBase.replace(/\/+$/, '');
  const getHeadersRef = useRef(getHeaders);
  useEffect(() => { getHeadersRef.current = getHeaders; }, [getHeaders]);
  const activeFarm = farms.find((farm) => (farm._id || farm.id) === farmId);
  const farmName = activeFarm?.name || '';
  const targetJob = restoreTarget || prepared;
  const canConfirm = !!targetJob && confirmFarmName === farmName && confirmJobId === String(targetJob._id || targetJob.id);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...getHeadersRef.current(),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
    return { response, data };
  }, [base]);

  const refreshJobs = useCallback(async (selectedFarmId = farmId) => {
    if (!selectedFarmId) { setJobs([]); return []; }
    const { data } = await request(`/archive/jobs?farmId=${encodeURIComponent(selectedFarmId)}`);
    const nextJobs = Array.isArray(data) ? data as ArchiveJob[] : [];
    setJobs(nextJobs);
    return nextJobs;
  }, [farmId, request]);

  const loadFarms = useCallback(async () => {
    const { data } = await request('/farms');
    const list = Array.isArray(data?.farms) ? data.farms : [];
    setFarms(list.filter((farm: ArchiveFarm & { archived?: boolean }) => !farm.archived));
    const first = list.find((farm: ArchiveFarm & { archived?: boolean }) => !farm.archived);
    setFarmId((current) => current && list.some((farm: ArchiveFarm) => (farm._id || farm.id) === current) ? current : (first?._id || first?.id || ''));
  }, [request]);

  useEffect(() => {
    if (!isOwner) return;
    setBusy('loading');
    setError('');
    loadFarms().catch((e) => setError(e instanceof Error ? e.message : 'Could not load farms'))
      .finally(() => setBusy(''));
  }, [isOwner, loadFarms]);

  useEffect(() => {
    if (!isOwner || !farmId) return;
    refreshJobs(farmId).catch((e) => setError(e instanceof Error ? e.message : 'Could not load archive history'));
  }, [isOwner, farmId, refreshJobs]);

  const clearMessages = () => { setError(''); setNotice(''); };

  const prepareArchive = async () => {
    clearMessages();
    setPrepared(null);
    setConfirmFarmName('');
    setConfirmJobId('');
    if (!farmId || !collection || !/^\d+$/.test(retentionYears) || Number(retentionYears) < 1 || Number(retentionYears) > 100) {
      setError('Choose a farm, collection, and retention period from 1 to 100 years.');
      return;
    }
    setBusy('prepare');
    try {
      const { data } = await request('/archive/jobs', {
        method: 'POST',
        body: JSON.stringify({ farmId, collection, retentionYears: Number(retentionYears) }),
      });
      if (!data.job) {
        setNotice(data.message || 'No records qualify for this retention period. No active records were changed.');
        await refreshJobs(farmId);
        return;
      }
      setPrepared(data.job as ArchiveJob);
      setNotice(`${L('Snapshot prepared:')} ${data.job.sourceCount} ${L('record(s) before')} ${data.job.cutoffDate}. ${L('Active records have not been removed.')}`);
      await refreshJobs(farmId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not prepare archive snapshot');
    } finally { setBusy(''); }
  };

  const downloadExport = async (job: ArchiveJob) => {
    clearMessages();
    setBusy(`export:${job._id || job.id}`);
    try {
      const id = String(job._id || job.id);
      const response = await fetch(`${base}/archive/jobs/${encodeURIComponent(id)}/export?farmId=${encodeURIComponent(farmId)}`, { headers: getHeadersRef.current() });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.message || `Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `muf-${job.collection}-archive-${id}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(L('Export download started. Wait for the download to finish before executing the archive.'));
      let refreshedJob: ArchiveJob | undefined;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const refreshed = await refreshJobs(farmId);
        refreshedJob = refreshed.find((item) => String(item._id || item.id) === id);
        if (refreshedJob?.exportDownloaded) break;
        if (attempt < 4) await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
      if (refreshedJob) setPrepared(refreshedJob);
      if (!refreshedJob?.exportDownloaded) setError(L('The download started, but the server has not confirmed the export marker yet. Refresh history before executing.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export download failed');
    } finally { setBusy(''); }
  };

  const executeArchive = async () => {
    if (!targetJob || !canConfirm) return;
    clearMessages();
    setBusy('execute');
    try {
      const id = String(targetJob._id || targetJob.id);
      const { data } = await request(`/archive/jobs/${encodeURIComponent(id)}/execute`, {
        method: 'POST',
        body: JSON.stringify({ farmId, confirmFarmName, confirmJobId }),
      });
      setNotice(`Archive status: ${data.state || 'completed'}; ${data.count ?? targetJob.sourceCount} record(s) processed.`);
      setPrepared(null);
      setRestoreTarget(null);
      setConfirmFarmName('');
      setConfirmJobId('');
      await refreshJobs(farmId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Archive execution failed. Active records should be checked before retrying.');
    } finally { setBusy(''); }
  };

  const restoreArchive = async () => {
    if (!restoreTarget || !canConfirm) return;
    clearMessages();
    setBusy('restore');
    try {
      const id = String(restoreTarget._id || restoreTarget.id);
      const { data } = await request(`/archive/jobs/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        body: JSON.stringify({ farmId, confirmFarmName, confirmJobId }),
      });
      setNotice(`Restore status: ${data.state || 'completed'}; ${data.count ?? restoreTarget.sourceCount} record(s) processed.`);
      setRestoreTarget(null);
      setConfirmFarmName('');
      setConfirmJobId('');
      await refreshJobs(farmId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed. The archive snapshot remains available.');
    } finally { setBusy(''); }
  };

  const loadReportRecords = async () => {
    clearMessages();
    if (!includeArchived || !reportJobId) {
      setReportRecords([]);
      setError('Enable archived records and select an archive job first.');
      return;
    }
    setBusy('records');
    try {
      const { data } = await request(`/archive/jobs/${encodeURIComponent(reportJobId)}/records?farmId=${encodeURIComponent(farmId)}`);
      setReportRecords(Array.isArray(data.records) ? data.records : []);
      setNotice(`Loaded ${Array.isArray(data.records) ? data.records.length : 0} archived record(s) for this explicitly selected archive report.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read archived records');
      setReportRecords([]);
    } finally { setBusy(''); }
  };

  const reportJob = useMemo(() => jobs.find((job) => String(job._id || job.id) === reportJobId), [jobs, reportJobId]);

  if (!isOwner) return null;

  return (
    <MufAdminCard icon={<Archive className="w-5 h-5" />} title={L('Yearly Archive')} subtitle={L('Owner-only archive, export, and restore controls')}>
      <div className="space-y-5">
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Archiving removes records from active lists only after a complete snapshot has been exported and the exact farm name and job ID are confirmed. Preparing a snapshot does not delete active records.</p>
        </div>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</div>}

        <section className="space-y-3">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{L('Prepare archive snapshot')}</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{L('Farm')}<select className={fieldClass} value={farmId} onChange={(e) => { setFarmId(e.target.value); setPrepared(null); setRestoreTarget(null); setConfirmFarmName(''); setConfirmJobId(''); setReportJobId(''); setReportRecords([]); }} disabled={busy !== '' || farms.length === 0}>
                <option value="">{L('Select farm')}</option>
                {farms.map((farm) => <option key={farm._id || farm.id} value={farm._id || farm.id}>{farm.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{L('Collection')}<select className={fieldClass} value={collection} onChange={(e) => { setCollection(e.target.value); setPrepared(null); setRestoreTarget(null); setConfirmFarmName(''); setConfirmJobId(''); }} disabled={busy !== ''}>
                {collections.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{L('Retention period (years)')}<input className={fieldClass} type="number" min="1" max="100" step="1" value={retentionYears} onChange={(e) => { setRetentionYears(e.target.value); setPrepared(null); setRestoreTarget(null); setConfirmFarmName(''); setConfirmJobId(''); }} disabled={busy !== ''} />
            </label>
          </div>
          <button type="button" className={`${buttonClass} bg-farm-600 text-white hover:bg-farm-700`} onClick={prepareArchive} disabled={busy !== '' || !farmId || collections.length === 0}>
            <Archive className="h-4 w-4" /> {busy === 'prepare' ? L('Preparing snapshot…') : L('Preview eligible records')}
          </button>
        </section>

        {prepared && (
          <section className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{L('Snapshot preview')}</h4>
            <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div><dt className="text-slate-500">{L('Farm')}</dt><dd className="mt-1 font-semibold">{farmName}</dd></div>
              <div><dt className="text-slate-500">{L('Collection')}</dt><dd className="mt-1 font-semibold">{prepared.collection}</dd></div>
              <div><dt className="text-slate-500">{L('Eligible records')}</dt><dd className="mt-1 font-semibold">{prepared.sourceCount}</dd></div>
              <div><dt className="text-slate-500">{L('Cutoff date')}</dt><dd className="mt-1 font-semibold">{prepared.cutoffDate}</dd></div>
              <div><dt className="text-slate-500">{L('Status')}</dt><dd className="mt-1 font-semibold">{prepared.state}</dd></div>
            </dl>
            <p className="text-xs text-slate-500">{L('The server has saved a snapshot of the exact eligible records. Download the export before continuing.')}</p>
            <button type="button" className={`${buttonClass} bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900`} onClick={() => downloadExport(prepared)} disabled={busy !== ''}>
              <Download className="h-4 w-4" /> {busy.startsWith('export:') ? L('Preparing download…') : L('Download archive export')}
            </button>
          </section>
        )}

        <section className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{L('Archive history')}</h4>
            <button type="button" className={`${buttonClass} border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800`} onClick={() => refreshJobs().catch((e) => setError(e.message))} disabled={busy !== '' || !farmId}>
              <RefreshCw className="h-4 w-4" />{L('Refresh')}</button>
          </div>
          {!jobs.length ? <p className="text-xs text-slate-500">{L('No archive jobs for this farm yet.')}</p> : (
            <div className="space-y-2">
              {jobs.map((job) => {
                const id = String(job._id || job.id);
                return <div key={id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-all text-xs font-bold text-slate-800 dark:text-slate-100">{job.collection} · {job.state}</p>
                      <p className="mt-1 break-all font-mono text-[10px] text-slate-500">{id}</p>
                      <p className="mt-1 text-xs text-slate-500">{job.sourceCount} records · cutoff {job.cutoffDate} · {job.retentionYears} year(s)</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={`${buttonClass} border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200`} onClick={() => downloadExport(job)} disabled={busy !== ''}><Download className="h-4 w-4" />{L('Export')}</button>
                      {["snapshot_ready", "archive_partial"].includes(job.state) && <button type="button" className={`${buttonClass} border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200`} onClick={() => { setPrepared(job); setRestoreTarget(null); setConfirmFarmName(''); setConfirmJobId(''); }}>{L('Continue')}</button>}
                      <button type="button" className={`${buttonClass} border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200`} onClick={() => { setReportJobId(id); setIncludeArchived(true); setReportRecords([]); }}><Eye className="h-4 w-4" />{L('Report')}</button>
                      {['archived', 'archive_partial', 'restored'].includes(job.state) && <button type="button" className={`${buttonClass} bg-amber-600 text-white hover:bg-amber-700`} onClick={() => { setRestoreTarget(job); setPrepared(null); setConfirmFarmName(''); setConfirmJobId(''); }}><RotateCcw className="h-4 w-4" />{L('Restore')}</button>}
                    </div>
                  </div>
                </div>;
              })}
            </div>
          )}
        </section>

        {((prepared && ['snapshot_ready', 'archive_partial'].includes(prepared.state)) || restoreTarget) && (
          <section className="space-y-3 rounded-xl border border-amber-200 p-4 dark:border-amber-900">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{restoreTarget ? L('Confirm archive restoration') : L('Confirm archive execution')}</h4>
            {!restoreTarget && !prepared?.exportDownloaded && <p className="text-xs text-amber-800 dark:text-amber-200">{L('Download the export first. The server enforces this requirement.')}</p>}
            <p className="text-xs text-slate-500">{L('Type the exact farm name and job ID. This is deliberately tedious because deleting records should not be a one-click hobby.')}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{L('Farm name')}<input className={fieldClass} value={confirmFarmName} onChange={(e) => setConfirmFarmName(e.target.value)} autoComplete="off" />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{L('Job ID')}<input className={fieldClass} value={confirmJobId} onChange={(e) => setConfirmJobId(e.target.value)} autoComplete="off" />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {restoreTarget ? (
                <button type="button" className={`${buttonClass} bg-amber-600 text-white hover:bg-amber-700`} onClick={restoreArchive} disabled={busy !== '' || !canConfirm}>
                  <RotateCcw className="h-4 w-4" /> {busy === 'restore' ? L('Restoring…') : L('Confirm restore')}
                </button>
              ) : (
                <button type="button" className={`${buttonClass} bg-red-600 text-white hover:bg-red-700`} onClick={executeArchive} disabled={busy !== '' || !canConfirm || !prepared?.exportDownloaded}>
                  <Archive className="h-4 w-4" /> {busy === 'execute' ? L('Archiving…') : L('Confirm archive')}
                </button>
              )}
              <button type="button" className={`${buttonClass} border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200`} onClick={() => { setPrepared(null); setRestoreTarget(null); setConfirmFarmName(''); setConfirmJobId(''); }}>{L('Cancel')}</button>
            </div>
          </section>
        )}

        <section className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={includeArchived} onChange={(e) => { setIncludeArchived(e.target.checked); setReportRecords([]); }} className="mt-0.5" />
            <span><strong>{L('Include archived records in this report')}</strong><br /><span className="text-slate-500">{L('Off by default. Existing active-data reports are not changed.')}</span></span>
          </label>
          {includeArchived && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[220px] flex-1 space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Archive job
                <select className={fieldClass} value={reportJobId} onChange={(e) => { setReportJobId(e.target.value); setReportRecords([]); }}>
                  <option value="">{L('Select archived job')}</option>
                  {jobs.map((job) => <option key={job._id || job.id} value={job._id || job.id}>{job.collection} · {job.cutoffDate} · {job.state}</option>)}
                </select>
              </label>
              <button type="button" className={`${buttonClass} bg-farm-600 text-white hover:bg-farm-700`} onClick={loadReportRecords} disabled={busy !== '' || !reportJobId}>
                <Eye className="h-4 w-4" /> {busy === 'records' ? L('Loading…') : L('Load archived report')}
              </button>
            </div>
          )}
          {includeArchived && reportJob && reportRecords.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">Showing {reportRecords.length} archived records from job {reportJob._id || reportJob.id}. This is a separate archive report view, not merged into active totals.</p>
              <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800"><tr><th className="p-2">{L('Record ID')}</th><th className="p-2">{L('Date')}</th><th className="p-2">{L('Record preview')}</th></tr></thead>
                  <tbody>{reportRecords.map((record, index) => <tr key={String(record._id || index)} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="max-w-32 break-all p-2 font-mono">{String(record._id || '—')}</td>
                    <td className="whitespace-nowrap p-2">{String(record.date || '—')}</td>
                    <td className="max-w-80 break-words p-2">{JSON.stringify(record)}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
          {includeArchived && reportJob && reportRecords.length === 0 && <p className="text-xs text-slate-500">{L('No archived records loaded for this report yet.')}</p>}
        </section>
      </div>
    </MufAdminCard>
  );
}
