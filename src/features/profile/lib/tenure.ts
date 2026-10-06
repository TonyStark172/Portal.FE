import { getLocalTimeZone, parseDate, today, type CalendarDate } from "@internationalized/date";

/**
 * How long someone has been with the company since `joinedOn` ("YYYY-MM-DD"), counted in whole months:
 * "4 năm 6 tháng", "2 năm", "5 tháng", or "12 ngày" in the first month.
 */
export function formatTenure(joinedOn: string, now: CalendarDate = today(getLocalTimeZone())): string {
  const joined = parseDate(joinedOn);
  if (joined.compare(now) > 0) return "Sắp gia nhập";

  // A month counts once its day of month has been reached (15/3 → 14/4 is still 0 months).
  const months = (now.year - joined.year) * 12 + (now.month - joined.month) - (now.day < joined.day ? 1 : 0);
  if (months === 0) {
    const days = now.compare(joined);
    return days === 0 ? "Hôm nay" : `${days} ngày`;
  }

  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years > 0 && `${years} năm`, rest > 0 && `${rest} tháng`].filter(Boolean).join(" ");
}
