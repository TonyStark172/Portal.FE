/**
 * Meetings are planned in the company's time, UTC+7 (Vietnam has no daylight saving time), whatever the browser's
 * time zone; the server expands recurrences with the same offset (Portal.BE MeetingRecurrence.BusinessOffset).
 */
export const BUSINESS_OFFSET_MS = 7 * 60 * 60 * 1000;
export const BUSINESS_OFFSET = "+07:00";
export const BUSINESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

const DATE_AND_TIME: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" };

/** An instant as date and time in business time, to the minute, e.g. "09:00 12/10/2026"; `options` picks other parts. */
export function formatBusinessTime(instant: string | Date, locale: string, options: Intl.DateTimeFormatOptions = DATE_AND_TIME) {
  return new Date(instant).toLocaleString(locale, { timeZone: BUSINESS_TIME_ZONE, hour12: false, ...options });
}
