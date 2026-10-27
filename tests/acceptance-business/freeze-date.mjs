// Test-only preload (node --import): freezes the wall clock at a fixed instant
// so timezone behaviour can be tested deterministically. Not app code.
// mongoose is loaded FIRST (it captures the real Date for its schema types);
// only then is the global Date replaced.
import { createRequire } from 'node:module';
try { createRequire(process.cwd() + '/server.js')('mongoose'); } catch {}
const FIXED = Date.parse(process.env.ACC_FREEZE_DATE || '2026-10-27T20:30:00.000Z');
const RealDate = Date;
class FrozenDate extends RealDate {
  constructor(...args) { super(...(args.length ? args : [FIXED])); }
  static now() { return FIXED; }
}
globalThis.Date = FrozenDate;
