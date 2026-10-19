"use client";

import { useState } from "react";
import { Calendar } from "@gravity-ui/icons";
import { Card, ListBox, Select, Skeleton } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import {
  useGetOrganizationQuery,
  useGetStaffDashboardQuery,
  type GenderStatsDto,
  type DashboardPeriod,
  type StaffDashboardDto,
} from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { formatCount, formatPercent } from "../../lib/genderSlices";
import { DashboardNoAccess } from "../DashboardNoAccess";
import { ChartCard } from "../layout/ChartCard";
import { DashboardGrid } from "../layout/DashboardGrid";
import { KpiSlot, KpiWidget, TrendFigure, TrendText } from "../layout/KpiWidget";
import { Sparkline, type TrendDirection } from "../layout/Sparkline";
import { DepartmentCard } from "./DepartmentCard";
import { startHeadcount, TrendCard } from "./TrendCard";

const PERIODS: DashboardPeriod[] = ["Month", "Quarter", "Year"];

const PERIOD_KEYS = { Month: "dashboard.thisMonth", Quarter: "dashboard.thisQuarter", Year: "dashboard.thisYear" } as const;

/** "Phân tích": the staff statistics (headcount, gender, changes, departments) of the chosen period. */
export function StaffDashboard() {
  const { hasPermission, isLoading } = useCurrentUser();
  const { t } = useLocale();

  return (
    <section aria-label={t("nav.analytics")} className="w-full">
      {/* The top bar already names the page. */}
      <h1 className="sr-only">{t("nav.analytics")}</h1>
      {isLoading ? <KpiSkeleton /> : hasPermission(Permissions.Dashboard.Staff) ? <StaffDashboardContent /> : <DashboardNoAccess />}
    </section>
  );
}

/** Rendered only for permitted users, so others never request the statistics. */
function StaffDashboardContent() {
  const [period, setPeriod] = useState<DashboardPeriod>("Month");
  const { data, isLoading, isError, refetch } = useGetStaffDashboardQuery({ period });
  const { t } = useLocale();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <PeriodSelect value={period} onChange={setPeriod} />
      </div>

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

function PeriodSelect({ value, onChange }: { value: DashboardPeriod; onChange: (period: DashboardPeriod) => void }) {
  const { t } = useLocale();
  const labelFor = (period: DashboardPeriod) => t(PERIOD_KEYS[period]);
  return (
    <Select
      aria-label={t("dashboard.thisMonth")}
      className="w-40"
      value={value}
      onChange={(next) => next && onChange(next as DashboardPeriod)}
    >
      <Select.Trigger className="gap-2">
        <Calendar aria-hidden className="size-4 shrink-0 text-muted" />
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {PERIODS.map((p) => (
            <ListBox.Item key={p} id={p} textValue={labelFor(p)}>
              {labelFor(p)}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function directionOf(change: number): TrendDirection {
  return change > 0 ? "up" : change < 0 ? "down" : "flat";
}

const signed = (change: number) => `${change < 0 ? "−" : "+"}${formatCount(Math.abs(change))}`;

function StaffKpis({ dashboard: { gender, staffChanges, trend }, period }: { dashboard: StaffDashboardDto; period: DashboardPeriod }) {
  const { t } = useLocale();
  // The company's name is the same for everyone signed in; the line is left out until it is known.
  const organizationName = useGetOrganizationQuery().data?.name;
  const net = staffChanges.joined - staffChanges.left;
  const direction = directionOf(net);
  const headcounts = trend.map((point) => point.headcount).filter((headcount): headcount is number => headcount !== null);
  const start = startHeadcount(trend);

  return (
    <KpiWidget title={t("dashboard.keyMetrics")} period={t(PERIOD_KEYS[period])}>
      <KpiSlot
        id="total"
        label={t("dashboard.totalStaff")}
        value={formatCount(gender.total)}
        trend={
          <>
            <TrendFigure direction={direction}>{net === 0 ? "0" : signed(net)}</TrendFigure> <TrendText>{t("dashboard.sinceStart")}</TrendText>
          </>
        }
        note={organizationName ? t("dashboard.workingAt").replace("{organization}", organizationName) : undefined}
        aside={<Sparkline values={start === null ? headcounts : [start, ...headcounts]} direction={direction} />}
      />
      <GenderSlot gender={gender} />
      <KpiSlot
        id="changes"
        label={t("dashboard.staffChanges")}
        value={net === 0 ? "0" : signed(net)}
        trend={
          <>
            <TrendFigure direction={direction}>
              <span className="text-success">+{formatCount(staffChanges.joined)}</span>
            </TrendFigure>{" "}
            <TrendText>
              {t("dashboard.joinedLabel").toLowerCase()} · <span className="text-danger">−{formatCount(staffChanges.left)}</span>{" "}
              {t("dashboard.leftLabel").toLowerCase()}
            </TrendText>
          </>
        }
        note={`${t("dashboard.turnoverRate")} ${formatTurnover(turnoverRate(staffChanges.left, trend))}`}
        aside={<Sparkline values={trend.map((point) => point.joined - point.left)} direction={direction} />}
      />
    </KpiWidget>
  );
}

/**
 * The genders as a bar sized by each one's share of the whole staff (not only of those who gave theirs), with the
 * shares as whole percents in its description; the line under it counts those who have not filled their gender in.
 */
function GenderSlot({ gender }: { gender: GenderStatsDto }) {
  const { t } = useLocale();
  const rows = [
    { key: "male", label: t("dashboard.male"), count: gender.male, color: "var(--chart-male)" },
    { key: "female", label: t("dashboard.female"), count: gender.female, color: "var(--chart-female)" },
    { key: "unspecified", label: t("dashboard.genderUnspecified"), count: gender.unspecified, color: "var(--chart-others)" },
  ].map((row) => ({
    ...row,
    text: `${formatCount(row.count)} · ${formatPercent(gender.total > 0 ? Math.round((row.count / gender.total) * 100) : 0)}`,
  }));
  const unspecified = rows[2];

  return (
    <KpiSlot
      id="gender"
      label={t("dashboard.gender")}
      value={t("dashboard.genderValue").replace("{male}", formatCount(gender.male)).replace("{female}", formatCount(gender.female))}
      trend={<span className="text-muted">{`${unspecified.label} ${unspecified.text}`}</span>}
    >
      <div
        role="img"
        aria-label={rows.map((row) => `${row.label} ${row.text}`).join(", ")}
        className="my-1 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-default"
      >
        {/* A gender nobody has takes no room (nor a gap); the others share the bar by their counts. */}
        {rows
          .filter((row) => row.count > 0)
          .map((row) => (
            <span
              key={row.key}
              data-segment={row.key}
              className="min-w-0 rounded-full"
              style={{ flex: `${row.count} 1 0%`, backgroundColor: row.color }}
            />
          ))}
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

function KpiSkeleton() {
  const { t } = useLocale();
  return (
    <Card role="status" aria-label={t("dashboard.loadingStats")} className="gap-3 p-3 sm:p-4">
      <Skeleton className="h-5 w-32 rounded-md" />
      <div className="grid grid-cols-3 gap-4 rounded-2xl bg-default/50 p-4 max-sm:grid-cols-1">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-1/2 rounded-md" />
            <Skeleton className="h-7 w-1/3 rounded-md" />
          </div>
        ))}
      </div>
    </Card>
  );
}
