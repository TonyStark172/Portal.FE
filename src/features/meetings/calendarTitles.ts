import { rangeOf } from "./meetingFilters";

const viDays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const viDate = (date: Date) => `${date.getUTCDate()} Th${date.getUTCMonth() + 1}`;

/**
 * The period a phone's toolbar names, short: "Tháng 10, 2026", "12–18 Th10", "T2, 12 Th10" ("Oct 12–18" in English).
 * `start` and `end` (exclusive) are the period's calendar dates (UTC midnights); `monthTitle` reads "{month}" and "{year}".
 */
export function compactTitle(viewType: string, start: Date, end: Date, locale: string, monthTitle: string): string {
  const range = rangeOf(viewType);
  if (range === "month") return monthTitle.replace("{month}", String(start.getUTCMonth() + 1)).replace("{year}", String(start.getUTCFullYear()));
  const last = new Date(end.getTime() - 86_400_000);
  if (locale === "vi-VN") {
    if (range === "day") return `${viDays[start.getUTCDay()]}, ${viDate(start)}`;
    return start.getUTCMonth() === last.getUTCMonth() ? `${start.getUTCDate()}–${viDate(last)}` : `${viDate(start)}–${viDate(last)}`;
  }
  if (range === "day") return start.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).formatRange(start, last).replace(/\s*–\s*/, "–");
}
