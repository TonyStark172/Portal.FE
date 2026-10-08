import type { DashboardPeriod, StaffTrendPointDto } from "@/shared/api/generated/portalApi";

/** "2026-10-05" (a date from the API) → "05/10/2026", without going through time zones. */
export function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export const periodLabels: Record<DashboardPeriod, string> = {
  Month: "Tháng này",
  Quarter: "Quý này",
  Year: "Năm nay",
};

/** The label under a bar: the day for a month, the week's first day for a quarter, the month for a year. */
export function trendLabel(point: Pick<StaffTrendPointDto, "from" | "to">, period: DashboardPeriod) {
  const [, month, day] = point.from.split("-");
  if (period === "Year") return `T${Number(month)}`;
  if (period === "Quarter") return `${day}/${month}`;
  return String(Number(day));
}
