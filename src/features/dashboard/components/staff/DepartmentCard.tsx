"use client";

import { Pie, PieChart } from "recharts";
import type { DepartmentStatsDto } from "@/shared/api/generated/portalApi";
import { toDepartmentSlices } from "../../lib/departmentSlices";
import { formatCount, formatPercent } from "../../lib/genderSlices";
import { ChartCard } from "../layout/ChartCard";
import { useLocale } from "@/shared/i18n";

const SIZE = 192;

/**
 * How the staff spreads over the departments: a donut of each department's share, and a legend with the exact
 * count and share (angles are hard to compare by eye, so the numbers carry the detail).
 */
export function DepartmentCard({ departments, headcount }: { departments: DepartmentStatsDto; headcount: number }) {
  const { t } = useLocale();
  const slices = toDepartmentSlices(departments);
  const seats = slices.reduce((sum, s) => sum + s.count, 0);

  return (
    <ChartCard
      title={t("dashboard.departments")}
      description={t("dashboard.departmentDescription")}
      isEmpty={slices.length === 0}
      emptyMessage={t("dashboard.noDepartmentData")}
    >
      {/* Side by side only when the card itself has room (32rem): next to another chart on a desktop with the
          sidebar open it is narrow though the screen is wide, and the donut would leave the names no width. */}
      <div className="@container flex flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center gap-6 @lg:flex-row @lg:gap-8">
          {/* The legend holds the same figures as text, so the drawing is hidden from screen readers. */}
          <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }} aria-hidden>
            <PieChart width={SIZE} height={SIZE} accessibilityLayer={false}>
              <Pie
                data={slices.map((s) => ({ name: s.name, value: s.count, fill: s.color }))}
                dataKey="value"
                nameKey="name"
                innerRadius="70%"
                outerRadius="100%"
                paddingAngle={slices.length > 1 ? 2 : 0}
                cornerRadius={4}
                stroke="none"
                startAngle={90}
                endAngle={-270}
                isAnimationActive="auto"
                animationDuration={900}
                animationEasing="ease-out"
              />
            </PieChart>
            <div data-donut-total className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold tabular-nums text-foreground">{formatCount(headcount)}</span>
              <span className="text-xs text-muted">{t("dashboard.staffUnit")}</span>
            </div>
          </div>

          <div className="flex w-full min-w-0 flex-col gap-3">
            <ul aria-label={t("dashboard.departmentList")} className="flex flex-col divide-y divide-separator">
              {slices.map((slice) => (
                <li key={slice.key} data-department-row className="flex items-center gap-2 py-2 text-sm">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
                  <span className="min-w-0 flex-1 text-foreground max-md:line-clamp-2 max-md:break-words md:truncate">{slice.key === "none" ? t("dashboard.noDepartment") : slice.key === "others" ? t("dashboard.otherDepartmentsCount").replace("{count}", slice.name.match(/\d+/)?.[0] ?? "") : slice.name}</span>
                  <span className="font-medium tabular-nums text-foreground">{formatCount(slice.count)}</span>
                  <span className="w-14 text-right tabular-nums text-muted">{formatPercent(slice.percent)}</span>
                </li>
              ))}
            </ul>
            {seats > headcount && (
              <p className="text-xs text-muted">
                {t("dashboard.concurrentNote").replace("{count}", formatCount(seats))}
              </p>
            )}
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
