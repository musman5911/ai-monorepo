'use strict';

const MINIMUM_ROLES = Object.freeze(['public', 'worker', 'manager', 'owner', 'secret']);
const ROLE_RANK = Object.freeze({ worker: 0, manager: 1, owner: 2 });
const AUTH_DENIALS = new Set([401, 403]);
const SECRET_DENIALS = new Set([401, 403, 404, 503]);
const CLOSED_SIGNUP_STATUSES = new Set([400, 401, 403, 404]);

function parseRouteRoleInventory(markdown) {
  const marker = '## Reviewed individual route entries';
  const start = markdown.indexOf(marker);
  if (start < 0) return new Map();
  const nextHeading = markdown.slice(start + marker.length).search(/^## /m);
  const section = markdown.slice(start + marker.length, nextHeading < 0 ? undefined : start + marker.length + nextHeading);
  const rows = new Map();
  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const columns = line.split('|').slice(1, -1).map(value => value.trim());
    if (columns.length < 4) continue;
    const [app, module, method, rawPath] = columns;
    if (!['dairy', 'agri', 'flock'].includes(app)) continue;
    if (!/^(routes\/[a-z0-9-]+|server\.js)$/.test(module)) continue;
    if (!/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|ALL)$/.test(method)) continue;
    const route = rawPath.replace(/^`|`$/g, '');
    const rawRole = columns.length >= 5 ? columns[4].trim().toLowerCase() : '';
    const role = MINIMUM_ROLES.includes(rawRole) ? rawRole : null;
    const key = app + '|' + module + '|' + method + ' ' + route;
    const existing = rows.get(key);
    if (existing) {
      existing.count += 1;
      if (existing.role !== role) existing.role = null;
      if (!role) existing.rawRole = rawRole;
    } else {
      rows.set(key, { role, rawRole, count: 1 });
    }
  }
  return rows;
}

function roleAllows(minimumRole, identity) {
  if (minimumRole === 'public') return true;
  if (minimumRole === 'secret') return false;
  const identityRank = ROLE_RANK[identity];
  const requiredRank = ROLE_RANK[minimumRole];
  return identityRank !== undefined && requiredRank !== undefined && identityRank >= requiredRank;
}

function checkRouteStatuses(routes) {
  const mismatches = [];
  for (const route of routes || []) {
    const { app, method, route: routePath, minimumRole, statuses } = route;
    if (!MINIMUM_ROLES.includes(minimumRole)) {
      mismatches.push({ app, method, route: routePath, identity: 'inventory', expected: MINIMUM_ROLES.join('|'), status: minimumRole || 'missing/invalid role' });
      continue;
    }
    for (const [identity, status] of Object.entries(statuses || {})) {
      const add = expected => mismatches.push({ app, method, route: routePath, identity, expected, status });
      if (!Number.isInteger(status)) {
        add('numeric HTTP status');
        continue;
      }
      if (route.closedSignup) {
        if (!CLOSED_SIGNUP_STATUSES.has(status)) add('closed-signup status 400|401|403|404');
        continue;
      }
      if (route.webhookAck) {
        if (status !== 200) add('200 no-op webhook acknowledgement');
        continue;
      }
      if (minimumRole === 'secret') {
        const denied = SECRET_DENIALS.has(status) || (route.rateLimitedCheck === true && status === 429);
        if (!denied) add(route.rateLimitedCheck ? 'secret denial or rate-limit response' : 'secret denial 401|403|404|503');
        continue;
      }
      const allowed = roleAllows(minimumRole, identity);
      const authDenied = AUTH_DENIALS.has(status);
      if (allowed && authDenied) add('allowed by minimum role ' + minimumRole);
      else if (!allowed && !authDenied) add('denied by minimum role ' + minimumRole + ' (401/403)');
    }
  }
  return mismatches;
}

module.exports = { MINIMUM_ROLES, parseRouteRoleInventory, roleAllows, checkRouteStatuses };
