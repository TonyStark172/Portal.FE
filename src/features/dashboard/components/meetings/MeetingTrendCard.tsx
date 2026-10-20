"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { DashboardPeriod, MeetingTrendPointDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { formatDate, periodLabel } from "../../lib/format";
import { formatHours, formatMeetings, formatNumber, meetingStepLabel } from "../../lib/meetingFormat";
import { ChartCard } from "../layout/ChartCard";

type Props = { trend: MeetingTrendPointDto[]; period: DashboardPeriod; from: string; to: string };

type Step = MeetingTrendPointDto & { label: string };

const axis = { tickLine: false, axisLine: false, tick: { fontSize: 11, fill: "var(--muted)" } } as const;

/**
 * The meetings of each step of the period (a week each for a month, a month otherwise) as bars, in the look of the
 * staff trend: a recessive grid, muted axes, the step's dates, meetings and hours on hover. The same figures are
 * listed for screen readers, the drawing being hidden from them.
 */
export function MeetingTrendCard({ trend, period, from, to }: Props) {
  const { t, locale } = useLocale();
  const steps: Step[] = trend.map((step) => ({ ...step, label: meetingStepLabel(step, period) }));

  return (
    <ChartCard
      title={t("dashboard.meetingTrend")}
      description={`${periodLabel(period, t)}: ${formatDate(from)} – ${formatDate(to)}`}
      isEmpty={trend.every((step) => step.meetingCount === 0)}
      emptyMessage={t("dashboard.noMeetings")}
    >
      <ul className="sr-only">
        {steps.map((step) => (
          <li key={step.from}>
            {formatDate(step.from)} – {formatDate(step.to)}: {formatMeetings(step.meetingCount, t, locale)}, {formatHours(step.totalHours, t, locale)}
          </li>
        ))}
      </ul>
      <div aria-hidden className="h-56 w-full">
        <BarChart responsive style={{ width: "100%", height: "100%" }} data={steps} accessibilityLayer={false} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke="var(--separator)" />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axis} width="auto" allowDecimals={false} tickFormatter={(value: number) => formatNumber(value, locale)} />
          <Tooltip content={StepTooltip} cursor={{ fill: "var(--default)", opacity: 0.6 }} />
          <Bar
            dataKey="meetingCount"
            fill="var(--accent)"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
            isAnimationActive="auto"
            animationDuration={900}
            animationEasing="ease-out"
          />
        </BarChart>
      </div>
    </ChartCard>
  );
}

function StepTooltip({ active, payload }: TooltipContentProps) {
  const { t, locale } = useLocale();
  const step = payload?.[0]?.payload as Step | undefined;
  if (!active || !step) return null;

  return (
    <div className="rounded-lg border border-separator bg-surface px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">
        {formatDate(step.from)} – {formatDate(step.to)}
      </p>
      <p className="text-muted">
        {t("dashboard.meetingCount")}: <span className="font-medium text-foreground">{formatNumber(step.meetingCount, locale)}</span>
      </p>
      <p className="text-muted">
        {t("dashboard.totalHours")}: <span className="font-medium text-foreground">{formatHours(step.totalHours, t, locale)}</span>
      </p>
    </div>
  );
}
