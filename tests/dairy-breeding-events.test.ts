import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Phase 2 Dairy breeding events server contracts', () => {
  const db = read('dairy_farm/backend/db.js');
  const routes = read('dairy_farm/backend/routes/breeding-events.js');
  const backup = read('dairy_farm/backend/routes/backup.js');
  const server = read('dairy_farm/backend/server.js');
  const demo = read('dairy_farm/backend/demo-data.js');

  it('registers BreedingEvent as a farm-scoped model in memory and MongoDB modes', () => {
    expect(db).toContain('const BreedingEventSchema = new mongoose.Schema');
    expect(db).toContain('BreedingEvent: BreedingEventSchema');
    expect(db).toContain("BreedingEvent = mongoose.model('BreedingEvent', BreedingEventSchema)");
    expect(db).toContain('const MUF_FARM_MODELS = { Cow, BreedingEvent,');
    expect(db).toContain('export { MUF_FARM_MODELS, Farm, connectDB, Cow, BreedingEvent,');
  });

  it('keeps the existing calendar route and mounts additive event routes', () => {
    expect(server).toContain("app.use('/api/breeding', breedingEventsRoutes)");
    expect(server).toContain("app.use('/api/breeding', breedingRoutes)");
    expect(routes).toContain("router.get('/events'");
    expect(routes).toContain("router.post('/events'");
    expect(routes).toContain("router.put('/events/:id'");
    expect(routes).toContain("router.delete('/events/:id'");
  });

  it('validates event types and ISO dates on the server', () => {
    expect(routes).toContain("['heat', 'service', 'pregnancy_check', 'calving']");
    expect(routes).toContain("readDate(body, 'date', errors, { required })");
    expect(routes).toContain('page must be a positive integer');
  });

  it('supports bounded pagination and farm-scoped list filters', () => {
    expect(routes).toContain('Math.min(Number(rawLimit), 200)');
    expect(routes).toContain("filter.cowId = String(req.query.cowId)");
    expect(routes).toContain('BreedingEvent.countDocuments(filter)');
    expect(routes).toContain('pages: Math.ceil(total / pg.limit)');
  });

  it('validates cow and farm-bull references using the scoped Cow model', () => {
    expect(routes).toContain('Cow.findById(payload.cowId).lean()');
    expect(routes).toContain('Cow.findById(payload.bullId).lean()');
    expect(routes).toContain('In-farm sire must be a male animal in the selected farm');
  });

  it('allows authenticated workers to create events but restricts event deletion to full-role users', () => {
    expect(routes).toMatch(/router.post\('\/events', protect,/);
    expect(routes).toMatch(/router.put\('\/events\/:id', protect,/);
    expect(routes).toMatch(/router.delete\('\/events\/:id', protect, adminOnly,/);
  });

  it('synchronizes legacy cow date fields from event history', () => {
    expect(routes).toContain("heat: 'heatDate', service: 'pregnancyDate', calving: 'calvingDate'");
    expect(routes).toContain('BreedingEvent.findOne({ cowId, type }).sort({ date: -1, createdAt: -1 })');
    expect(routes).toContain('await syncCowDate(event.cowId, event.type)');
  });

  it('includes breeding events in manual and monthly backup payloads and restore collections', () => {
    expect(backup).toContain('BreedingEvent.find().lean()');
    expect(backup).toContain('breedingEvents: BreedingEvent');
    expect(backup).toContain('breedingEvents,');
  });

  it('seeds disposable memory-mode demo breeding events', () => {
    expect(db).toContain('connectDB, Cow, BreedingEvent, Milk');
    expect(demo).toContain('const { Cow, BreedingEvent, Milk');
    expect(demo).toContain("type: 'pregnancy_check'");
    expect(demo).toContain('await BreedingEvent.insertMany');
  });

  it('adds a dedicated runtime checker to the normal farm-check command', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['check-breeding-events']).toBe('node tools/check-dairy-breeding-events.js');
    expect(pkg.scripts?.['check-farms']).toBe('node tools/check-farm-scope.js && node tools/check-dairy-breeding-events.js');
    expect(read('tools/check-dairy-breeding-events.js')).toContain('All Dairy breeding event checks passed.');
  });
});
