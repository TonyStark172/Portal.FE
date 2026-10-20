"use client";

import { useCurrentUser } from "@/features/auth";
import {
  useGetStaffDashboardQuery,
  type GenderStatsDto,
  type DashboardPeriod,
  type StaffDashboardDto,
} from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { formatCount, formatPercent } from "../../lib/genderSlices";
import { periodLabel } from "../../lib/format";
import { directionOf, signed } from "../../lib/trend";
import { AnalyticsPeriodSelect, useAnalyticsPeriod } from "../AnalyticsPeriod";
import { DashboardNoAccess } from "../DashboardNoAccess";
import { ChartCard } from "../layout/ChartCard";
import { DashboardGrid } from "../layout/DashboardGrid";
import { CountUp, KpiSlot, KpiWidget, TrendFigure, TrendText } from "../layout/KpiWidget";
import { KpiSkeleton } from "../layout/KpiSkeleton";
import { Sparkline } from "../layout/Sparkline";
import { DepartmentCard } from "./DepartmentCard";
import { startHeadcount, TrendCard } from "./TrendCard";

/** The HR tab of "Phân tích": the staff statistics (headcount, gender, changes, departments) of the chosen period. */
export function StaffDashboard() {
  const { hasPermission, isLoading } = useCurrentUser();

  return (
    <div className="w-full">
      {isLoading ? <KpiSkeleton /> : hasPermission(Permissions.Dashboard.Staff) ? <StaffDashboardContent /> : <DashboardNoAccess />}
    </div>
  );
}

/** Rendered only for permitted users, so others never request the statistics. */
function StaffDashboardContent() {
  const [period, setPeriod] = useAnalyticsPeriod();
  const { data, isLoading, isError, refetch } = useGetStaffDashboardQuery({ period });
  const { t } = useLocale();

  return (
    <div className="flex flex-col gap-4">
      <AnalyticsPeriodSelect value={period} onChange={setPeriod} />

      {isLoading ? (
        <>
          <KpiSkeleton />
          <DashboardGrid>
            <DashboardGrid.Item>
              <ChartCard title={t("dashboard.trend")} isLoading>
                {null}
              </ChartCard>
            </DashboardGrid.Item>
            <DashboardGrid.Item>
              <ChartCard title={t("dashboard.departments")} isLoading>
                {null}
              </ChartCard>
            </DashboardGrid.Item>
          </DashboardGrid>
        </>
      ) : isError || !data ? (
        <ChartCard title={t("dashboard.staff")} isError onRetry={() => void refetch()}>
          {null}
        </ChartCard>
      ) : (
        <>
          <StaffKpis dashboard={data} period={period} />
          <DashboardGrid>
            <DashboardGrid.Item>
              <TrendCard
                trend={data.trend}
                period={period}
                from={data.from}
                to={data.to}
              />
            </DashboardGrid.Item>
            <DashboardGrid.Item>
              <DepartmentCard departments={data.departments} headcount={data.gender.total} />
            </DashboardGrid.Item>
          </DashboardGrid>
        </>
      )}
    </div>
  );
}

function StaffKpis({ dashboard: { gender, staffChanges, trend }, period }: { dashboard: StaffDashboardDto; period: DashboardPeriod }) {
  const { t } = useLocale();
  const net = staffChanges.joined - staffChanges.left;
  const direction = directionOf(net);
  const headcounts = trend.map((point) => point.headcount).filter((headcount): headcount is number => headcount !== null);
  const start = startHeadcount(trend);

  return (
    <KpiWidget title={t("dashboard.keyMetrics")} period={periodLabel(period, t)}>
      <KpiSlot
        id="total"
        label={t("dashboard.totalStaff")}
        hero
        value={<CountUp value={gender.total} text={formatCount(gender.total)} />}
        trend={
          <>
            <TrendFigure direction={direction}>{net === 0 ? "0" : signed(net)}</TrendFigure> <TrendText>{t("dashboard.sinceStart")}</TrendText>
          </>
        }
        chart={<Sparkline values={start === null ? headcounts : [start, ...headcounts]} direction={direction} />}
      />
      <GenderSlot gender={gender} />
      <KpiSlot
        id="changes"
        label={t("dashboard.staffChanges")}
        meta={`${t("dashboard.turnoverRate")} ${formatTurnover(turnoverRate(staffChanges.left, trend))}`}
        value={<CountUp value={net} text={net === 0 ? "0" : signed(net)} signed />}
        trend={
          <>
            {/* Each half keeps its words together; a narrow tile breaks the line at the dot. */}
            <span className="whitespace-nowrap">
              <span className="text-success">+{formatCount(staffChanges.joined)}</span>{" "}
              <TrendText>{t("dashboard.joinedLabel").toLowerCase()}</TrendText>
            </span>{" "}
            <TrendText>·</TrendText>{" "}
            <span className="whitespace-nowrap">
              <span className="text-danger">−{formatCount(staffChanges.left)}</span>{" "}
              <TrendText>{t("dashboard.leftLabel").toLowerCase()}</TrendText>
            </span>
          </>
        }
        chart={<Sparkline values={trend.map((point) => point.joined - point.left)} direction={direction} />}
      />
    </KpiWidget>
  );
}

/** The vertical ticks a bar segment is drawn with: 2px of `color`, then 3px of nothing, over and over. */
const ticks = (color: string) => `repeating-linear-gradient(90deg, ${color} 0 2px, transparent 2px 5px)`;

/**
 * The genders as a tick bar: a legend over a row of thin ticks split by each one's share of the whole staff (not only
 * of those who gave theirs); under the start of each part a line in its colour leads down to its count and percent. A
 * gender nobody has takes no part; the bar's description says every share, nobody's included.
 */
function GenderSlot({ gender }: { gender: GenderStatsDto }) {
  const { t } = useLocale();
  const rows = [
    { key: "male", label: t("dashboard.male"), count: gender.male, color: "var(--chart-male)" },
    { key: "female", label: t("dashboard.female"), count: gender.female, color: "var(--chart-female)" },
    { key: "unspecified", label: t("dashboard.genderUnspecified"), count: gender.unspecified, color: "var(--chart-others)" },
  ].map((row) => {
    const percent = formatPercent(gender.total > 0 ? Math.round((row.count / gender.total) * 100) : 0);
    return { ...row, percent, text: `${formatCount(row.count)} · ${percent}` };
  });
  const parts = rows.filter((row) => row.count > 0);

  return (
    <KpiSlot id="gender" label={t("dashboard.gender")}>
      <div className="flex flex-col gap-2.5">
        <ul data-slot="legend" className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {rows.map((row) => (
            <li key={row.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-[2px]" style={{ backgroundColor: row.color }} />
              {row.label}
            </li>
          ))}
        </ul>
        <div
          role="img"
          aria-label={rows.map((row) => `${row.label} ${row.text}`).join(", ")}
          className="kpi-wipe flex gap-[3px]"
        >
          {parts.length === 0 ? (
            <span className="h-4 flex-1" style={{ background: ticks("var(--default)") }} />
          ) : (
            parts.map((row) => (
              <div key={row.key} data-segment={row.key} className="flex min-w-max flex-col" style={{ flex: `${row.count} 1 0%` }}>
                <span className="h-4" style={{ background: ticks(row.color) }} />
                <span className="flex flex-col border-s-2 ps-2 pt-1.5" style={{ borderColor: row.color }}>
                  <span data-slot="count" className="text-sm font-semibold tabular-nums leading-tight text-foreground">
                    {formatCount(row.count)}
                  </span>
                  <span data-slot="percent" className="text-xs tabular-nums text-muted">
                    {row.percent}
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </KpiSlot>
  );
}

/**
 * The turnover rate: those who left during the period over the headcount when it began. That start is the first
 * trend step's headcount before its own joins and leaves (`startHeadcount`, which also gives the chart its first
 * point). With no start, or a start of zero (a company's first period), there is no rate to give: null.
 */
export function turnoverRate(left: number, trend: StaffDashboardDto["trend"]): number | null {
  const start = startHeadcount(trend);
  return start === null || start <= 0 ? null : (left / start) * 100;
}

const formatTurnover = (rate: number | null) => (rate === null ? "—" : formatPercent(rate));
