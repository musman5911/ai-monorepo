import { createHash } from 'crypto';
import { mufGetFarmContext, mufGetDefaultFarmId } from '../muf-farms.mjs';

// Stable per-farm, per-worker, per-day identity prevents concurrent app,
// task, and Telegram writes from creating separate rows for one attendance day.
export function mufLaborAttendanceId(workerId, date) {
  const farmId = String(mufGetFarmContext()?.farmId || mufGetDefaultFarmId() || '').trim();
  const worker = String(workerId || '').trim();
  const day = String(date || '').trim();
  if (!farmId || !worker || !day) throw new TypeError('Farm, worker ID and attendance date are required.');
  return createHash('sha256').update('muf-labor-attendance:' + farmId + ':' + worker + ':' + day).digest('hex').slice(0, 24);
}
