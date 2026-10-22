// Farm local calendar day helpers — thin wrapper around the shared muf-date
// twin (../muf-date.mjs, byte-identical in all three backends).
// Default offset is Pakistan Standard Time (UTC+5). Override with TZ_OFFSET_HOURS.
import {
  TZ_OFFSET_HOURS,
  mufToday,
  mufLocalParts,
  mufLocalHour,
  mufLocalDateTimeStr,
  mufCurrentMonthStr,
} from '../muf-date.mjs';

export const todayStr = mufToday;
export const localParts = mufLocalParts;
export const localHour = mufLocalHour;
export const localDateTimeStr = mufLocalDateTimeStr;
export const currentMonthStr = mufCurrentMonthStr;
export { TZ_OFFSET_HOURS };
