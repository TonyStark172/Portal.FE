import type { DashboardPeriod, MeetingTrendPointDto } from "@/shared/api/generated/portalApi";
import type { Translate } from "./format";

const cache = new Map<string, Intl.NumberFormat>();
const numberFormat = (locale: string, options: Intl.NumberFormatOptions) => {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = cache.get(key);
  if (!format) cache.set(key, (format = new Intl.NumberFormat(locale, options)));
  return format;
};

/** A count in the reader's language: 1 234 → "1.234" (vi) or "1,234" (en). */
export const formatNumber = (value: number, locale: string) => numberFormat(locale, { maximumFractionDigits: 0 }).format(value);

/** Hours to one decimal at most, without a trailing zero: 12.5 → "12,5", 12 → "12" (the API gives two decimals). */
export const formatHourFigure = (hours: number, locale: string) => numberFormat(locale, { maximumFractionDigits: 1 }).format(hours);

/** Hours with their unit: "12,5 giờ". */
export const formatHours = (hours: number, t: Translate, locale: string) =>
  t("dashboard.hoursValue").replace("{value}", formatHourFigure(hours, locale));

/** People per meeting, always to one decimal: "4,5", "0,0". */
export const formatAverage = (value: number, locale: string) =>
  numberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);

/** "12 cuộc họp". */
export const formatMeetings = (count: number, t: Translate, locale: string) =>
  t("dashboard.meetingsValue").replace("{count}", formatNumber(count, locale));

/** A trend step's label: the day a month's week starts ("08/10"), the month otherwise ("T10"). */
export function meetingStepLabel(step: Pick<MeetingTrendPointDto, "from">, period: DashboardPeriod) {
  const [, month, day] = step.from.split("-");
  return period === "Month" ? `${day}/${month}` : `T${Number(month)}`;
}

const pad = (hour: number) => String(hour).padStart(2, "0");

/** The hour a meeting starts in: 9 → "09:00–10:00". */
export const hourRange = (hour: number) => `${pad(hour)}:00–${pad(hour + 1)}:00`;

/** The position of the largest count (the first, on a tie), or -1 when every count is zero. */
export function busiestIndex(counts: number[]) {
  let best = -1;
  counts.forEach((count, index) => {
    if (count > 0 && (best === -1 || count > counts[best])) best = index;
  });
  return best;
}

/** How dark a cell is tinted: 0 for none, then 1 to 4 by its share of the largest count. */
export const tintLevel = (count: number, max: number) => (count <= 0 || max <= 0 ? 0 : Math.max(1, Math.ceil((count / max) * 4)));
