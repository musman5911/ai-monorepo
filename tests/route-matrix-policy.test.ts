import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import routeMatrixPolicy from '../tools/route-matrix-policy.cjs';
const { MINIMUM_ROLES, parseRouteRoleInventory, checkRouteStatuses } = routeMatrixPolicy;
const root = resolve(__dirname, '..');

describe('inventory-driven route-matrix role policy', () => {
  it('flags a missing manager guard when a worker reaches a manager route', () => {
    // Simulates DELETE /api/cows/:id after adminOnly has been removed:
    // the reviewed minimum role stays manager, but the worker receives 200.
    const fakeRoutes = [{
      app: 'dairy',
      method: 'DELETE',
      route: '/api/cows/:id',
      minimumRole: 'manager',
      statuses: { anonymous: 401, worker: 200, manager: 200, owner: 200 },
    }];
    const mismatches = checkRouteStatuses(fakeRoutes);
    expect(mismatches).toContainEqual(expect.objectContaining({
      app: 'dairy',
      method: 'DELETE',
      route: '/api/cows/:id',
      identity: 'worker',
      expected: 'denied by minimum role manager (401/403)',
      status: 200,
    }));

    const guardedRoutes = [{
      ...fakeRoutes[0],
      statuses: { anonymous: 401, worker: 403, manager: 200, owner: 200 },
    }];
    expect(checkRouteStatuses(guardedRoutes)).toEqual([]);
  });

  it('requires every reviewed route to carry one of the five explicit role values', () => {
    const inventory = readFileSync(resolve(root, 'docs/security/route-permission-inventory.md'), 'utf8');
    const parsed = parseRouteRoleInventory(inventory);
    expect(parsed.size).toBeGreaterThan(0);
    for (const entry of parsed.values()) {
      expect(entry.count).toBe(1);
      expect(MINIMUM_ROLES).toContain(entry.role);
    }
    const missingRole = parseRouteRoleInventory(inventory.replace(
      '| dairy | routes/cows | DELETE | `/:id` | manager |',
      '| dairy | routes/cows | DELETE | `/:id` |'
    ));
    expect(missingRole.get('dairy|routes/cows|DELETE /:id')?.role).toBeNull();
    expect(checkRouteStatuses([{
      app: 'dairy', method: 'DELETE', route: '/api/cows/:id', minimumRole: null, statuses: { worker: 200 },
    }])).toContainEqual(expect.objectContaining({ identity: 'inventory', status: 'missing/invalid role' }));
  });

  it('keeps route-signature fingerprints limited to modules with HTTP declarations', () => {
    const inventory = readFileSync(resolve(root, 'docs/security/route-permission-inventory.md'), 'utf8');
    const signatureSection = inventory.split('## Reviewed route method signatures')[1] || '';
    const fingerprints = [...signatureSection.matchAll(/^\|\s*(dairy|agri|flock)\s*\|\s*(routes\/[a-z0-9-]+|server\.js)\s*\|\s*([a-f0-9]{8})\s*\|\s*(\d+)\s*\|/gim)];
    expect(fingerprints.length).toBeGreaterThan(0);
    expect(fingerprints.every(row => Number(row[4]) > 0)).toBe(true);
  });

  it('closed signup accepts only 400, 401, 403 or 404', () => {
    for (const status of [400, 401, 403, 404]) {
      expect(checkRouteStatuses([{ app: 'flock', method: 'POST', route: '/signup/verify', minimumRole: 'public', closedSignup: true, statuses: { anonymous: status } }])).toEqual([]);
    }
    for (const status of [200, 429, 500, 503]) {
      expect(checkRouteStatuses([{ app: 'flock', method: 'POST', route: '/signup/verify', minimumRole: 'public', closedSignup: true, statuses: { anonymous: status } }])).not.toEqual([]);
    }
  });

  it('does not count 429 as a secret-role denial, except in a rate-limit check', () => {
    const row = { app: 'agri', method: 'GET', route: '/cron/dispatch-report', minimumRole: 'secret', statuses: { anonymous: 429 } };
    expect(checkRouteStatuses([row])).not.toEqual([]);
    expect(checkRouteStatuses([{ ...row, rateLimitedCheck: true }])).toEqual([]);
    expect(checkRouteStatuses([{ ...row, statuses: { anonymous: 503 } }])).toEqual([]);
  });
});
