"use client";

import { useCurrentUser } from "@/features/auth";
import { useGetMeetingDashboardQuery, type DashboardPeriod, type MeetingDashboardDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { periodLabel } from "../../lib/format";
import { formatAverage, formatHourFigure, formatHours, formatNumber } from "../../lib/meetingFormat";
import { directionOf, signed } from "../../lib/trend";
import { AnalyticsPeriodSelect, useAnalyticsPeriod } from "../AnalyticsPeriod";
import { DashboardNoAccess } from "../DashboardNoAccess";
import { ChartCard } from "../layout/ChartCard";
import { DashboardGrid } from "../layout/DashboardGrid";
import { CountUp, KpiSlot, KpiWidget, TrendFigure, TrendText } from "../layout/KpiWidget";
import { KpiSkeleton } from "../layout/KpiSkeleton";
import { Sparkline } from "../layout/Sparkline";
import { MeetingKindsCard } from "./MeetingKindsCard";
import { MeetingRoomsCard } from "./MeetingRoomsCard";
import { MeetingTimesCard } from "./MeetingTimesCard";
import { MeetingTrendCard } from "./MeetingTrendCard";

/** The meetings tab of "Phân tích": how much the organisation meets, of which kind, where and when, in the period. */
export function MeetingDashboard() {
  const { hasPermission, isLoading } = useCurrentUser();

  return (
    <div className="w-full">
      {isLoading ? <KpiSkeleton /> : hasPermission(Permissions.Dashboard.Meetings) ? <MeetingDashboardContent /> : <DashboardNoAccess />}
    </div>
  );
}

const CARD_TITLES = ["dashboard.meetingTrend", "dashboard.meetingKinds", "dashboard.topRooms", "dashboard.busiestTimes"];

/** Rendered only for permitted users, so others never request the figures. */
function MeetingDashboardContent() {
  const [period, setPeriod] = useAnalyticsPeriod();
  const { data, isLoading, isError, refetch } = useGetMeetingDashboardQuery({ period });
  const { t } = useLocale();

  return (
    <div className="flex flex-col gap-4">
      <AnalyticsPeriodSelect value={period} onChange={setPeriod} />

      {isLoading ? (
        <>
          <KpiSkeleton />
          <DashboardGrid>
            {CARD_TITLES.map((title) => (
              <DashboardGrid.Item key={title}>
                <ChartCard title={t(title)} isLoading>
                  {null}
                </ChartCard>
              </DashboardGrid.Item>
            ))}
          </DashboardGrid>
        </>
      ) : isError || !data ? (
        <ChartCard title={t("dashboard.meetings")} isError onRetry={() => void refetch()}>
          {null}
        </ChartCard>
      ) : (
        <>
          <MeetingKpis dashboard={data} period={period} />
          <DashboardGrid>
            <DashboardGrid.Item>
              <MeetingTrendCard trend={data.trend} period={period} from={data.from} to={data.to} />
            </DashboardGrid.Item>
            <DashboardGrid.Item>
              <MeetingKindsCard kinds={data.byKind} />
            </DashboardGrid.Item>
            <DashboardGrid.Item>
              <MeetingRoomsCard rooms={data.topRooms} />
            </DashboardGrid.Item>
            <DashboardGrid.Item>
              <MeetingTimesCard weekdays={data.busiestWeekday} hours={data.busiestHour} />
            </DashboardGrid.Item>
          </DashboardGrid>
        </>
      )}
    </div>
  );
}

/** The three headline figures: meetings and their hours against the period before, and the people per meeting. */
function MeetingKpis({ dashboard: { totals, trend }, period }: { dashboard: MeetingDashboardDto; period: DashboardPeriod }) {
  const { t, locale } = useLocale();
  const meetingChange = totals.meetingCount - totals.previousMeetingCount;
  // Rounded as shown, so a change too small to show reads as none rather than "+0".
  const hourChange = Math.round((totals.totalHours - totals.previousTotalHours) * 10) / 10;
  const hoursUnit = t("dashboard.hoursValue").replace("{value}", "");
  const sincePrevious = <TrendText>{t("dashboard.sincePrevious")}</TrendText>;

  return (
    <KpiWidget title={t("dashboard.keyMetrics")} period={periodLabel(period, t)}>
      <KpiSlot
        id="meetings"
        label={t("dashboard.meetingCount")}
        hero
        value={<CountUp value={totals.meetingCount} text={formatNumber(totals.meetingCount, locale)} />}
        trend={
          <>
            <TrendFigure direction={directionOf(meetingChange)}>{signed(meetingChange, (value) => formatNumber(value, locale))}</TrendFigure>{" "}
            {sincePrevious}
          </>
        }
        chart={<Sparkline values={trend.map((step) => step.meetingCount)} direction={directionOf(meetingChange)} />}
      />
      <KpiSlot
        id="hours"
        label={t("dashboard.totalHours")}
        value={
          <CountUp value={totals.totalHours} text={formatHours(totals.totalHours, t, locale)} fractionDigits={[0, 1]} suffix={hoursUnit} />
        }
        trend={
          <>
            <TrendFigure direction={directionOf(hourChange)}>
              {signed(hourChange, (value) => formatHourFigure(value, locale))}
              {hoursUnit}
            </TrendFigure>{" "}
            {sincePrevious}
          </>
        }
        chart={<Sparkline values={trend.map((step) => step.totalHours)} direction={directionOf(hourChange)} />}
      />
      <KpiSlot
        id="participants"
        label={t("dashboard.averageParticipants")}
        meta={t("dashboard.canceledCount").replace("{count}", formatNumber(totals.canceledCount, locale))}
        value={<CountUp value={totals.averageParticipants} text={formatAverage(totals.averageParticipants, locale)} fractionDigits={[1, 1]} />}
      />
    </KpiWidget>
  );
}
