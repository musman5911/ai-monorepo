import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');

describe('Phase 3 Dairy breeding event screens', () => {
  const panel = read('dairy_farm/client/src/components/BreedingEventsPanel.tsx');
  const tab = read('dairy_farm/client/src/components/BreedingTab.tsx');
  const api = read('dairy_farm/client/src/api.ts');

  it('adds the event manager to the existing Breeding tab without removing the calendar', () => {
    expect(tab).toContain("import BreedingEventsPanel from './BreedingEventsPanel'");
    expect(tab).toContain('<BreedingEventsPanel isAdmin={isAdmin} />');
    expect(tab).toContain("L('Breeding Calendar')");
    expect(tab).toContain("L('Next 30 days')");
  });

  it('provides create/edit forms for heat, service, pregnancy checks and calving', () => {
    expect(panel).toContain("heat: 'Heat'");
    expect(panel).toContain("service: 'Service / Tikka'");
    expect(panel).toContain("pregnancy_check: 'Pregnancy check'");
    expect(panel).toContain("calving: 'Calving'");
    expect(panel).toContain("api.addBreedingEvent(payload)");
    expect(panel).toContain("api.updateBreedingEvent(editingId, payload)");
    expect(panel).toContain('type="date"');
    expect(panel).toContain("L('Technician')");
    expect(panel).toContain("L('Result')");
    expect(panel).toContain("L('Notes')");
  });

  it('supports farm bull, outside bull and outside straw father details', () => {
    expect(panel).toContain("value=\"farm_bull\"");
    expect(panel).toContain("value=\"outside_bull\"");
    expect(panel).toContain("value=\"outside_straw\"");
    expect(panel).toContain('filteredBulls.map');
    expect(panel).toContain('type="search"');
    expect(panel).toContain("L('Search farm bulls')");
    expect(panel).toContain("L('Outside bull name')");
    expect(panel).toContain("L('Semen code')");
    expect(panel).toContain('api.getCows()');
  });

  it('shows cow-specific history with filters, edit and permission-gated delete', () => {
    expect(panel).toContain("L('Breeding event history')");
    expect(panel).toContain("L('Filter by cow')");
    expect(panel).toContain("L('Event type')");
    expect(panel).toContain('event.cowId');
    expect(panel).toContain('openEdit(event)');
    expect(panel).toContain('{isAdmin && <button');
    expect(panel).toContain('api.deleteBreedingEvent(event._id)');
  });

  it('uses the shared MUF popup and form field classes', () => {
    expect(panel).toContain("import DetailModal from '../muf/core/muf-modal'");
    expect(panel).toContain('size="big"');
    expect(panel).toContain("'muf-field'");
    expect(panel).toContain("'muf-label block mb-1'");
    expect(panel).toContain('useConfirm');
  });

  it('exposes typed client methods for the existing server event API', () => {
    expect(api).toContain("req('/breeding/events'");
    expect(api).toContain('addBreedingEvent');
    expect(api).toContain('updateBreedingEvent');
    expect(api).toContain('deleteBreedingEvent');
  });

  it('keeps all shared Urdu dictionary twins identical and translates new screen labels', () => {
    const apps = [
      'dairy_farm/client/src/muf/data',
      'flock_farm/client/src/muf/data',
      'agri_farm/frontend/src/muf/data',
    ];
    const keys = [
      'Add breeding event', 'Breeding event history', 'Breeding event saved',
      'Breeding event deleted', 'Filter by cow', 'All cows', 'All event types',
      'Father source', 'Bull on this farm', 'Outside bull', 'Outside semen straw',
      'Outside bull name', 'Semen code', 'Technician', 'Result',
      'Pregnancy check', 'Service / Tikka', 'Calving', 'Delete this breeding event?',
      'Record heat, service, pregnancy checks and calving for each cow.',
    ];
    const combinedByApp = apps.map((base) => [1, 2, 3, 4, 5, 6]
      .map((part) => read(path.join(base, `muf-urdu-terms-${part}.ts`)))
      .join('\n'));
    for (let i = 1; i < combinedByApp.length; i++) expect(combinedByApp[i]).toBe(combinedByApp[0]);
    for (const key of keys) expect(combinedByApp[0]).toContain(JSON.stringify(key) + ':');
  });
});
