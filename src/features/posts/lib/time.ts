import { getStoredLocale, type Locale } from "@/shared/i18n/locale";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "Vừa xong", "5 phút trước", "3 giờ trước", "hôm qua"…, then the date after a week. */
export function formatPostTime(iso: string, now = Date.now(), locale?: Locale): string {
  const selected = locale ?? getStoredLocale();
  const elapsed = now - new Date(iso).getTime();
  if (elapsed < MINUTE) return selected === "en-US" ? "Just now" : "Vừa xong";
  const relative = new Intl.RelativeTimeFormat(selected, { numeric: "auto" });
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), "hour");
  if (elapsed < 7 * DAY) return relative.format(-Math.floor(elapsed / DAY), "day");
  return new Intl.DateTimeFormat(selected, { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

const pad = (value: number) => String(value).padStart(2, "0");

/** When a pin ends, short: "13/10 lúc 14:30" (Intl's vi-VN day/month uses a dash). */
export function formatPinnedUntil(iso: string, locale?: Locale): string {
  const date = new Date(iso);
  if ((locale ?? getStoredLocale()) === "en-US") return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(date);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} lúc ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Full date and time, e.g. for a tooltip: "Thứ Hai, 6 tháng 10, 2026 lúc 14:30". */
export const formatFullTime = (iso: string, locale?: Locale) =>
  new Intl.DateTimeFormat(locale ?? getStoredLocale(), { dateStyle: "full", timeStyle: "short" }).format(new Date(iso));

/** Length of a video: "0:42", "12:05", "1:02:09". */
export function formatDuration(seconds: number): string {
  const total = Math.floor(seconds);
  const [h, m, s] = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
