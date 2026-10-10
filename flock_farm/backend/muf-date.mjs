import { MUF_ENV } from './muf-env.mjs';
// muf-date.mjs — shared farm-calendar day helpers for all three backends.
//
// One file, three byte-identical copies (backend/muf-date.mjs in each app).
// Farm local time defaults to Pakistan (UTC+5); override TZ_OFFSET_HOURS.
// Same-day guards, drop alarms, cron reports and calendar dates all go
// through these helpers so the three apps never disagree about "today".

const TZ_OFFSET_HOURS = Number.isFinite(Number(MUF_ENV.tzOffsetHours))
  ? Number(MUF_ENV.tzOffsetHours)
  : 5;
const TZ_OFFSET_MS = TZ_OFFSET_HOURS * 60 * 60 * 1000;

// "YYYY-MM-DD" in farm local time
export function mufToday(date = new Date()) {
  return new Date(date.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

// Date N days before/after today in farm local time (negative N = future)
export function mufDaysAgo(days, date = new Date()) {
  const shifted = new Date(date.getTime() + TZ_OFFSET_MS);
  shifted.setUTCDate(shifted.getUTCDate() - days);
  return shifted.toISOString().slice(0, 10);
}

// Farm-local calendar parts: { year, month (1..12), day, hour, minute, weekday (0=Sun..6=Sat) }
export function mufLocalParts(date = new Date()) {
  const d = new Date(date.getTime() + TZ_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

export function mufLocalHour(date = new Date()) {
  return mufLocalParts(date).hour;
}

// "YYYY-MM-DD HH:MM" in farm local time (cron report replies)
export function mufLocalDateTimeStr(date = new Date()) {
  const p = mufLocalParts(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

// Current month as "YYYY-MM" in farm local time
export function mufCurrentMonthStr(date = new Date()) {
  const p = mufLocalParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

export { TZ_OFFSET_HOURS };
