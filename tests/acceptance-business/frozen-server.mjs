// Test-only wrapper: starts the real server normally (all mongoose schemas
// capture the real Date), THEN freezes the global clock for request handling.
// Usage: ACC_BACKEND_DIR=<abs backend dir> node frozen-server.mjs
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = process.env.ACC_BACKEND_DIR;
await import(pathToFileURL(path.join(dir, 'server.js')).href);
const FIXED = Date.parse(process.env.ACC_FREEZE_DATE || '2026-10-27T20:30:00.000Z');
const RealDate = Date;
class FrozenDate extends RealDate {
  constructor(...args) { super(...(args.length ? args : [FIXED])); }
  static now() { return FIXED; }
}
globalThis.Date = FrozenDate;
console.log(`[frozen-server] clock frozen at ${new RealDate(FIXED).toISOString()}`);
setInterval(() => {}, 10000);
