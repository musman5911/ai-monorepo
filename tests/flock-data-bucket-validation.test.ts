import { describe, expect, it } from 'vitest';
import { validateDataBucketValue, validateDataBaseVersion } from '../flock_farm/backend/data-bucket-validation.mjs';

describe('Flock generic data bucket validation', () => {
  it('requires array buckets to be lists of plain object records', () => {
    expect(validateDataBucketValue('expenses', []).error).toBeUndefined();
    expect(validateDataBucketValue('expenses', {}).error).toMatch(/must be a list/);
    expect(validateDataBucketValue('expenses', [null]).error).toMatch(/must be an object/);
    expect(validateDataBucketValue('settings', []).error).toMatch(/JSON object/);
    expect(validateDataBucketValue('settings', { dailySummary: true }).error).toBeUndefined();
  });

  it('rejects missing attendance identity and duplicate worker/day records', () => {
    expect(validateDataBucketValue('laborAttendance', [
      { id: 'att-1', workerId: 'worker-1', date: '2026-11-08', dayType: 'full' },
    ]).error).toBeUndefined();
    expect(validateDataBucketValue('laborAttendance', [
      { id: 'att-1', workerId: 'worker-1', date: '2026-11-08', dayType: 'full' },
      { id: 'att-2', workerId: 'worker-1', date: '2026-11-08', dayType: 'half' },
    ]).error).toMatch(/already has attendance/);
    expect(validateDataBucketValue('laborAttendance', [
      { id: 'att-1', workerId: 'worker-1', date: '2026-11-08' },
      { id: 'att-2', workerId: 'worker-2', date: '2026-11-08' },
    ]).error).toBeUndefined();
    expect(validateDataBucketValue('laborAttendance', [
      { id: 'att-1', workerId: 'worker-1', date: 'not-a-date' },
    ]).error).toMatch(/worker ID and YYYY-MM-DD date/);
  });

  it('rejects unsafe nested keys, non-finite numbers, deep structures and oversized strings', () => {
    const polluted = JSON.parse('{"safe":1,"__proto__":{"isAdmin":true}}');
    expect(validateDataBucketValue('settings', polluted).error).toMatch(/blocked object key/);
    expect(validateDataBucketValue('settings', { limit: Number.POSITIVE_INFINITY }).error).toMatch(/finite number/);
    expect(validateDataBucketValue('settings', { note: 'x'.repeat(10_001) }).error).toMatch(/too long/);
    let deep: any = { value: true };
    for (let i = 0; i < 22; i += 1) deep = { next: deep };
    expect(validateDataBucketValue('settings', deep).error).toMatch(/nested too deeply/);
  });

  it('caps rows and rejects unsupported keys', () => {
    expect(validateDataBucketValue('expenses', Array(25_001).fill({})).error).toMatch(/record limit/);
    expect(validateDataBucketValue('not-a-bucket', []).error).toMatch(/Unknown data bucket/);
  });

  it('requires non-negative safe integer version numbers', () => {
    expect(validateDataBaseVersion(0).value).toBe(0);
    expect(validateDataBaseVersion(4).value).toBe(4);
    expect(validateDataBaseVersion(undefined).error).toMatch(/required/);
    expect(validateDataBaseVersion(null).error).toMatch(/required/);
    expect(validateDataBaseVersion(-1).error).toMatch(/required/);
    expect(validateDataBaseVersion('1').error).toMatch(/required/);
    expect(validateDataBaseVersion(Number.MAX_SAFE_INTEGER + 1).error).toMatch(/required/);
  });
});
