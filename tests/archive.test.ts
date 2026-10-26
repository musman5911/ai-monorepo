import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
describe('Phase 11 Dairy archive server contracts', () => {
  const db = read('dairy_farm/backend/db.js'), routes = read('dairy_farm/backend/routes/archive.js'), server = read('dairy_farm/backend/server.js');
  const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
  it('registers archive job and snapshot models as farm-scoped in both DB modes', () => {
    for (const s of ['const ArchiveJobSchema = new mongoose.Schema','const ArchiveRecordSchema = new mongoose.Schema','ArchiveJob: ArchiveJobSchema','ArchiveRecord: ArchiveRecordSchema',"ArchiveJob = mongoose.model('ArchiveJob', ArchiveJobSchema)","ArchiveRecord = mongoose.model('ArchiveRecord', ArchiveRecordSchema)",'ArchiveJob, ArchiveRecord']) expect(db).toContain(s);
  });
  it('mounts additive owner-only archive routes', () => { expect(server).toContain("app.use('/api/archive',  archiveRoutes)"); expect(server).toContain("app.use('/api/backup',   backupRoutes)"); expect(routes).toContain('protectUnscoped, ownerOnly'); });
  it('requires explicit farm, collection, and retention years', () => { expect(routes).toContain('farmId is required'); expect(routes).toContain('collection must be milk or expenses'); expect(routes).toContain('retentionYears must be an integer from 1 to 100'); });
  it('bounds snapshot size and retains source data on snapshot failure', () => { expect(routes).toContain('const MAX_RECORDS = 5000'); expect(routes).toContain('const MAX_EXPORT_BYTES = 8 * 1024 * 1024'); expect(routes).toContain("state: 'snapshot_failed'"); expect(routes).toContain('Active records were retained'); });
  it('requires a completed export and exact confirmation before removal', () => { expect(routes).toContain('job.exportDownloaded !== true'); expect(routes).toContain('req.body?.confirmJobId !== String(job._id)'); expect(routes).toContain('req.body?.confirmFarmName !== farm.name'); });
  it('keeps archive, snapshot and source queries farm-filtered', () => { expect(routes).toContain('ArchiveJob.findOne({ _id: jobId, farmId })'); expect(routes).toContain('ArchiveRecord.find({ farmId, jobId })'); expect(routes).toContain('Model.deleteOne({ _id: item.sourceId, farmId })'); });
  it('supports archive reads and conflict-aware restore', () => { expect(routes).toContain("router.get('/jobs/:jobId/records'"); expect(routes).toContain("router.post('/jobs/:jobId/restore'"); expect(routes).toContain('A conflicting active record exists'); });
  it('adds the archive runtime checker to standard farm checks', () => { expect(pkg.scripts?.['check-archive']).toBe('node tools/check-dairy-archive.js'); expect(read('tools/check-dairy-archive.js')).toContain('Archive farm A does not remove farm B records'); });
});
