"use client";

import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { DashboardPeriod, StaffTrendPointDto } from "@/shared/api/generated/portalApi";
import { formatDate, periodLabels, trendLabel } from "../../lib/format";
import { formatCount } from "../../lib/genderSlices";
import { ChartCard } from "../layout/ChartCard";

type Props = {
  trend: StaffTrendPointDto[];
  period: DashboardPeriod;
  joined: number;
  left: number;
  from: string;
  to: string;
};

type Point = StaffTrendPointDto & { label: string; isStart?: boolean };

/**
 * The headcount when the period began: the first step's, before its joins and leaves. Without it the line would
 * start after the first step and miss its changes.
 */
export function startHeadcount(trend: StaffTrendPointDto[]): number | null {
  const first = trend[0];
  return first?.headcount == null ? null : first.headcount - first.joined + first.left;
}

const axis = { tickLine: false, axisLine: false, tick: { fontSize: 11, fill: "var(--muted)" } } as const;

/**
 * The headcount over the period (a week each for a month, a month each otherwise): whether the company is growing
 * or shrinking. The joins and leaves behind each step show on hover; their totals head the card.
 */
export function TrendCard({ trend, period, joined, left, from, to }: Props) {
  const start = startHeadcount(trend);
  const data: Point[] = [
    ...(start === null
      ? []
      : [{ from, to: from, joined: 0, left: 0, headcount: start, label: "Đầu kỳ", isStart: true }]),
    ...trend.map((point) => ({ ...point, label: trendLabel(point, period) })),
  ];
  const known = data.map((p) => p.headcount).filter((h): h is number => h !== null);
  // Zoomed on the headcount's range, so small changes on a large staff still show.
  const low = Math.min(...known);
  const high = Math.max(...known);
  const padding = Math.max(2, Math.round((high - low) * 0.25));
  const net = joined - left;

  return (
    <ChartCard
      title="Tổng nhân sự theo thời gian"
      description={`${periodLabels[period]}: ${formatDate(from)} – ${formatDate(to)}`}
      summary={
        <div className="flex gap-8">
          <Figure id="joined" value={`+${formatCount(joined)}`} label="Vào làm" className="text-success" />
          <Figure id="left" value={`−${formatCount(left)}`} label="Nghỉ việc" className="text-danger" />
          <Figure id="net" value={`${net >= 0 ? "+" : "−"}${formatCount(Math.abs(net))}`} label="Thay đổi ròng" />
        </div>
      }
      isEmpty={known.length === 0}
      emptyMessage="Chưa có số liệu cho kỳ này."
    >
      <div aria-hidden className="h-56 w-full">
        <AreaChart responsive style={{ width: "100%", height: "100%" }} data={data} accessibilityLayer={false}>
          <defs>
            <linearGradient id="headcount-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--separator)" />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={8} />
          <YAxis
            {...axis}
            width="auto"
            allowDecimals={false}
            domain={[Math.max(0, low - padding), high + padding]}
            tickFormatter={(value: number) => formatCount(value)}
          />
          <Tooltip content={TrendTooltip} cursor={{ stroke: "var(--muted)", strokeDasharray: "4 4" }} />
          <Area
            type="monotone"
            dataKey="headcount"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#headcount-fill)"
            activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
            isAnimationActive="auto"
            animationDuration={900}
            animationEasing="ease-out"
          />
        </AreaChart>
      </div>
    </ChartCard>
  );
}

function Figure({ id, value, label, className = "text-foreground" }: { id: string; value: string; label: string; className?: string }) {
  return (
    <div data-figure={id} className="flex flex-col">
      <span className={`text-xl font-semibold tabular-nums ${className}`}>{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function TrendTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point || point.headcount === null) return null;

  if (point.isStart)
    return (
      <div className="rounded-lg border border-separator bg-surface px-3 py-2 text-xs shadow-md">
        <p className="mb-1 font-medium text-foreground">Đầu kỳ ({formatDate(point.from)})</p>
        <p className="text-muted">
          Tổng nhân sự: <span className="font-medium text-foreground">{formatCount(point.headcount)}</span>
        </p>
      </div>
    );

  return (
    <div className="rounded-lg border border-separator bg-surface px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">
        {formatDate(point.from)} – {formatDate(point.to)}
      </p>
      <p className="text-muted">
        Tổng nhân sự: <span className="font-medium text-foreground">{formatCount(point.headcount)}</span>
      </p>
      <p className="text-muted">
        Vào làm: <span className="font-medium text-success">+{formatCount(point.joined)}</span>
      </p>
      <p className="text-muted">
        Nghỉ việc: <span className="font-medium text-danger">−{formatCount(point.left)}</span>
      </p>
    </div>
  );
}
