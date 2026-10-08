"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { DashboardPeriod, StaffTrendPointDto } from "@/shared/api/generated/portalApi";
import { formatDate, periodLabels, trendLabel } from "../../lib/format";
import { formatCount } from "../../lib/genderSlices";
import { ChartCard } from "../layout/ChartCard";

const SERIES = [
  { key: "joined", label: "Vào làm", color: "var(--chart-joined)" },
  { key: "left", label: "Nghỉ việc", color: "var(--chart-left)" },
] as const;

type Props = {
  trend: StaffTrendPointDto[];
  period: DashboardPeriod;
  joined: number;
  left: number;
  from: string;
  to: string;
};

/** How many joined and left, step by step through the period (day, week or month). */
export function TrendCard({ trend, period, joined, left, from, to }: Props) {
  const data = trend.map((point) => ({ ...point, label: trendLabel(point, period) }));

  return (
    <ChartCard
      title="Biến động nhân sự"
      description={`${periodLabels[period]}: ${formatDate(from)} – ${formatDate(to)}`}
      actions={<Legend />}
      summary={
        <div className="flex gap-8">
          <Figure value={`+${formatCount(joined)}`} label="Vào làm" />
          <Figure value={`−${formatCount(left)}`} label="Nghỉ việc" />
          <Figure value={`${joined - left >= 0 ? "+" : "−"}${formatCount(Math.abs(joined - left))}`} label="Thay đổi ròng" />
        </div>
      }
    >
      <div aria-hidden className="h-56 w-full">
        <BarChart responsive style={{ width: "100%", height: "100%" }} data={data} barGap={2} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="var(--separator)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={8}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width="auto"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
          />
          <Tooltip cursor={{ fill: "var(--default)", opacity: 0.5 }} content={TrendTooltip} />
          {SERIES.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          ))}
        </BarChart>
      </div>
    </ChartCard>
  );
}

function Legend() {
  return (
    <ul aria-hidden className="flex items-center gap-3 text-xs text-muted">
      {SERIES.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function TrendTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as (StaffTrendPointDto & { label: string }) | undefined;
  if (!active || !point) return null;

  const range = point.from === point.to ? formatDate(point.from) : `${formatDate(point.from)} – ${formatDate(point.to)}`;
  return (
    <div className="rounded-lg border border-separator bg-surface px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{range}</p>
      {SERIES.map((s) => (
        <p key={s.key} className="flex items-center gap-1.5 text-muted">
          <span className="size-2 rounded-full" style={{ background: s.color }} />
          {s.label}: <span className="font-medium text-foreground">{formatCount(point[s.key])}</span>
        </p>
      ))}
    </div>
  );
}
