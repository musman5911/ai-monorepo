import { createHash } from 'crypto';

// Stable per-worker/per-day identity prevents concurrent app, task, and
// Telegram writes from creating separate rows for the same attendance day.
export function mufLaborAttendanceId(workerId, date) {
  const worker = String(workerId || '').trim();
  const day = String(date || '').trim();
  if (!worker || !day) throw new TypeError('Worker ID and attendance date are required.');
  return createHash('sha256').update('muf-labor-attendance:' + worker + ':' + day).digest('hex').slice(0, 24);
}
