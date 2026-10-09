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

/**
 * The label of a chart step, whose headcount is the one at its end: the week's last day for a month ("14/10"),
 * the month otherwise ("T10").
 */
export function trendLabel(point: Pick<StaffTrendPointDto, "from" | "to">, period: DashboardPeriod) {
  if (period === "Month") {
    const [, month, day] = point.to.split("-");
    return `${day}/${month}`;
  }
  return `T${Number(point.from.split("-")[1])}`;
}
