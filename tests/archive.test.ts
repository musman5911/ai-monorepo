import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Phase 11 shared archive server contracts', () => {
  const shared = read('shared/muf-yearly-archive.mjs');
  const dairyDb = read('dairy_farm/backend/db.js');
  const flockDb = read('flock_farm/backend/db.js');
  const agriDb = read('agri_farm/backend/db.js');
  const dairyRoute = read('dairy_farm/backend/routes/archive.js');
  const flockRoute = read('flock_farm/backend/routes/archive.js');
  const agriRoute = read('agri_farm/backend/routes/archive.js');
  const flockServer = read('flock_farm/backend/server.js');
  const agriServer = read('agri_farm/backend/server.js');
  const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };

  it('uses one shared archive workflow across all three apps', () => {
    for (const route of [dairyRoute, flockRoute, agriRoute]) expect(route).toContain("../../../shared/muf-yearly-archive.mjs");
    expect(shared).toContain("muf-yearly-archive-v1");
  });
  it('registers Dairy archive job and snapshot models as farm-scoped in both DB modes', () => {
    for (const s of ['const ArchiveJobSchema = new mongoose.Schema','const ArchiveRecordSchema = new mongoose.Schema','ArchiveJob: ArchiveJobSchema','ArchiveRecord: ArchiveRecordSchema',"ArchiveJob = mongoose.model('ArchiveJob', ArchiveJobSchema)","ArchiveRecord = mongoose.model('ArchiveRecord', ArchiveRecordSchema)",'ArchiveJob, ArchiveRecord']) expect(dairyDb).toContain(s);
  });
  it('registers Flock and Agri archive models in memory and real database modes', () => {
    for (const s of ["const ArchiveJob = mongoose.model('MufArchiveJob', ArchiveJobSchema)", "const ArchiveRecord = mongoose.model('MufArchiveRecord', ArchiveRecordSchema)", 'MufArchiveJob: ArchiveJob', 'MufArchiveRecord: ArchiveRecord', 'export { Farm, User, ArchiveJob, ArchiveRecord']) expect(flockDb).toContain(s);
    for (const s of ['ArchiveJob: ArchiveJobSchema', 'ArchiveRecord: ArchiveRecordSchema', 'ArchiveJob, ArchiveRecord', 'MUF_FARM_MODELS = {\n  ArchiveJob, ArchiveRecord']) expect(agriDb).toContain(s);
  });
  it('mounts archive routes in each app', () => {
    expect(dairyRoute).toContain('ArchiveJob');
    expect(flockServer).toContain("app.use('/api/archive', archiveRoutes)");
    expect(agriServer).toContain("app.use('/api/archive', archiveRoutes)");
  });
  it('supports each required high-volume collection', () => {
    for (const s of ['milk','expenses']) expect(dairyRoute).toContain(s);
    for (const s of ['batchFeedLogs','batchMortalityLogs','batchExpenseLogs','batchSaleLogs','batchWeightLogs','batchEggLogs','batchVaccinationLogs']) expect(flockRoute).toContain(s);
    expect(agriRoute).toContain('finance');
  });
  it('requires explicit farm, collection and retention period and bounds snapshot size', () => {
    expect(shared).toContain('farmId is required');
    expect(shared).toContain('retentionYears must be an integer from 1 to 100');
    expect(shared).toContain('const MAX_RECORDS = 5000, MAX_BYTES = 8 * 1024 * 1024');
    expect(shared).toContain("state:'snapshot_failed'");
  });
  it('requires completed export and exact typed confirmation before removal', () => {
    expect(shared).toContain('job.exportDownloaded !== true');
    expect(shared).toContain('req.body?.confirmJobId !== String(job._id)');
    expect(shared).toContain('req.body?.confirmFarmName !== farm.name');
  });
  it('keeps archive jobs, snapshots, and source operations farm-filtered', () => {
    expect(shared).toContain('ArchiveJob.findOne({ _id: jobId, farmId })');
    expect(shared).toContain('ArchiveRecord.find({ farmId, jobId })');
    expect(shared).toContain('Model.deleteOne({ _id:item.sourceId, farmId })');
  });
  it('supports archive reads, idempotent retry and conflict-aware restoration', () => {
    expect(shared).toContain("job.state === 'archived'");
    expect(shared).toContain("router.get('/jobs/:jobId/records'");
    expect(shared).toContain("router.post('/jobs/:jobId/restore'");
    expect(shared).toContain('A conflicting active record exists');
  });
  it('runs disposable archive runtime checks for all three apps', () => {
    expect(pkg.scripts?.['check-archive']).toBe('node tools/check-dairy-archive.js && node tools/check-flock-archive.js && node tools/check-agri-archive.js');
    expect(read('tools/check-dairy-archive.js')).toContain('archived expense leaves active list');
    expect(read('tools/check-flock-archive.js')).toContain('Flock batch feed-cost total excludes archived log');
    expect(read('tools/check-agri-archive.js')).toContain('Agri analytics totals exclude archived finance');
  });
});
