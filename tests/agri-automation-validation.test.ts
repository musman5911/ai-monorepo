import { describe, expect, it } from 'vitest';
import { escapeHtml, normalizeAutomationSettings, normalizeDigestRequest, normalizeFarmLocation } from '../agri_farm/backend/automation-validation.mjs';
import { readFileSync } from 'node:fs';

describe('Agri automation input validation', () => {
  it('keeps only supported settings and preserves server-managed last_run', () => {
    expect(normalizeAutomationSettings({
      cron_enabled: true, schedule: '0 8 * * 0', recipient: ' owner@example.com, accounts@example.com ',
      alert_soil: false, alert_finance: true, alert_tasks: false, last_run: 999, farmId: 'other',
    }, { lastRun: 123 })).toEqual({ value: {
      cron_enabled: true, schedule: '0 8 * * 0', alert_soil: false,
      alert_finance: true, alert_tasks: false,
      recipient: 'owner@example.com, accounts@example.com', last_run: 123,
    } });
  });
  it('rejects malformed schedules, recipients, booleans and empty enabled recipient list', () => {
    expect(normalizeAutomationSettings({ schedule: '* * * * *', recipient: 'a@b.com' }).error).toMatch(/Schedule/);
    expect(normalizeAutomationSettings({ recipient: 'not-email' }).error).toMatch(/valid email/);
    expect(normalizeAutomationSettings({ recipient: '' }).error).toMatch(/required/);
    expect(normalizeAutomationSettings({ cron_enabled: 'true', recipient: 'a@b.com' }).error).toMatch(/true or false/);
  });
  it('validates digest dates and booleans', () => {
    expect(normalizeDigestRequest({ start_date: '2026-02-31' }).error).toMatch(/valid calendar date/);
    expect(normalizeDigestRequest({ start_date: '2026-11-05', end_date: '2026-11-04' }).error).toMatch(/later/);
    expect(normalizeDigestRequest({ include_tasks: 'yes' }).error).toMatch(/true or false/);
  });
  it('bounds farm coordinates and escapes report HTML fields', () => {
    expect(normalizeFarmLocation({ lat: 91, lon: 72 }).error).toMatch(/Latitude/);
    expect(normalizeFarmLocation({ lat: 33.8, lon: 181 }).error).toMatch(/Longitude/);
    expect(normalizeFarmLocation({ lat: '33.8', lon: '72.8', city: 'Taxila', raw_dms: 'N' }).value.lat).toBe(33.8);
    expect(escapeHtml('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  });
  it('uses allowlisted automation settings and does not return recipient addresses from manual dispatch', () => {
    const route = readFileSync(new URL('../agri_farm/backend/routes/automations.js', import.meta.url), 'utf8');
    expect(route).toContain('normalizeAutomationSettings(req.body || {}');
    expect(route).toContain("message: 'Custom report dispatched successfully.'");
    expect(route).not.toContain('Custom report successfully dispatched to:');
  });
});
