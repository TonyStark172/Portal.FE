"use client";

import { Pie, PieChart } from "recharts";
import type { GenderStatsDto } from "@/shared/api/generated/portalApi";
import { formatCount, formatPercent, toGenderSlices } from "../../lib/genderSlices";
import { ChartCard } from "../layout/ChartCard";

const SIZE = 192;

/**
 * Active staff by gender (men and women): a donut for the proportions, and a row each with the exact count, share
 * and a bar. People who have not filled in their gender yet are only counted in a note.
 */
export function GenderCard({ stats }: { stats: GenderStatsDto }) {
  const slices = toGenderSlices(stats);
  const drawn = slices.filter((s) => s.count > 0);
  const known = stats.male + stats.female;

  return (
    <ChartCard
      title="Cơ cấu giới tính"
      description="Nhân sự đang làm việc, theo giới tính trong hồ sơ."
      isEmpty={known === 0}
      emptyMessage="Chưa có nhân sự nào cập nhật giới tính."
    >
      <div className="flex flex-1 flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
        {/* The rows hold the same figures as text, so the drawing is hidden from screen readers. */}
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }} aria-hidden>
          <PieChart width={SIZE} height={SIZE} accessibilityLayer={false}>
            <Pie
              data={drawn.map((s) => ({ name: s.label, value: s.count, fill: s.color }))}
              dataKey="value"
              nameKey="name"
              innerRadius="70%"
              outerRadius="100%"
              paddingAngle={drawn.length > 1 ? 2 : 0}
              cornerRadius={4}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            />
          </PieChart>
          <div data-donut-total className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums text-foreground">{formatCount(known)}</span>
            <span className="text-xs text-muted">nhân sự</span>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-3">
          <ul aria-label="Số nhân sự theo giới tính" className="flex flex-col gap-3">
            {slices.map((slice) => (
              <li key={slice.key} data-gender-row={slice.key} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
                  <span className="flex-1 text-foreground">{slice.label}</span>
                  <span className="font-medium tabular-nums text-foreground">{formatCount(slice.count)}</span>
                  <span className="w-12 text-right tabular-nums text-muted">{formatPercent(slice.percent)}</span>
                </div>
                <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-default">
                  <div data-bar className="h-full rounded-full" style={{ width: `${slice.percent}%`, background: slice.color }} />
                </div>
              </li>
            ))}
          </ul>
          {stats.unspecified > 0 && (
            <p className="text-xs text-muted">
              {formatCount(stats.unspecified)} nhân sự chưa cập nhật giới tính, không tính vào biểu đồ.
            </p>
          )}
        </div>
      </div>
    </ChartCard>
  );
}
