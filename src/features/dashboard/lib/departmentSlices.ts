import type { DepartmentStatsDto } from "@/shared/api/generated/portalApi";

export type DepartmentSlice = {
  key: string;
  name: string;
  count: number;
  /** Share of all the seats (someone in two departments is two seats), 0–100. */
  percent: number;
  /** Chart colour; follows the light or dark theme (see globals.css). */
  color: string;
};

/** Departments shown one by one; the others share a single "Khác" slice so no slice is too thin to see. */
const SHOWN = 5;

const COLORS = Array.from({ length: SHOWN }, (_, i) => `var(--chart-${i + 1})`);

/**
 * Donut slices: the five largest departments, then "Khác" for the rest and "Chưa có phòng ban" for people with no
 * position. Departments nobody works in have no slice.
 */
export function toDepartmentSlices(stats: DepartmentStatsDto): DepartmentSlice[] {
  const staffed = [...stats.items].filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
  const shown = staffed.slice(0, SHOWN);
  const rest = staffed.slice(SHOWN);

  const slices: Omit<DepartmentSlice, "percent">[] = shown.map((d, i) => ({
    key: String(d.departmentId),
    name: d.name,
    count: d.count,
    color: COLORS[i],
  }));
  if (rest.length > 0)
    slices.push({
      key: "others",
      name: `Khác (${rest.length} phòng ban)`,
      count: rest.reduce((sum, d) => sum + d.count, 0),
      color: "var(--chart-others)",
    });
  if (stats.withoutDepartment > 0)
    slices.push({ key: "none", name: "Chưa có phòng ban", count: stats.withoutDepartment, color: "var(--chart-none)" });

  const seats = slices.reduce((sum, s) => sum + s.count, 0);
  return slices.map((s) => ({ ...s, percent: seats > 0 ? (s.count / seats) * 100 : 0 }));
}
