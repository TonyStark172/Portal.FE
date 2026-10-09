"use client";

import { useState } from "react";
import { Calendar } from "@gravity-ui/icons";
import { Card, ListBox, Select, Skeleton } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import {
  useGetStaffDashboardQuery,
  type DashboardPeriod,
  type StaffDashboardDto,
} from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { periodLabels } from "../../lib/format";
import { formatCount, formatPercent, toGenderSlices } from "../../lib/genderSlices";
import { DashboardNoAccess } from "../DashboardNoAccess";
import { DashboardToolbarActions } from "../DashboardToolbar";
import { ChartCard } from "../layout/ChartCard";
import { DashboardGrid } from "../layout/DashboardGrid";
import { KpiCard } from "../layout/KpiCard";
import { DepartmentCard } from "./DepartmentCard";
import { StaffEmployees } from "./StaffEmployees";
import { TrendCard } from "./TrendCard";

const PERIODS: DashboardPeriod[] = ["Month", "Quarter", "Year"];

/** The staff tab: statistics on top (headcount, gender, changes, departments), the people working here below. */
export function StaffDashboard() {
  const { hasPermission, isLoading } = useCurrentUser();

  if (isLoading) return <KpiSkeleton />;
  if (!hasPermission(Permissions.Dashboard.Staff)) return <DashboardNoAccess />;

  return <StaffDashboardContent />;
}

/** Rendered only for permitted users, so others never request the statistics. */
function StaffDashboardContent() {
  const [period, setPeriod] = useState<DashboardPeriod>("Month");
  const { data, isLoading, isError, refetch } = useGetStaffDashboardQuery({ period });

  return (
    <div className="flex flex-col gap-4">
      <DashboardToolbarActions>
        <PeriodSelect value={period} onChange={setPeriod} />
      </DashboardToolbarActions>

      {isLoading ? (
        <>
          <KpiSkeleton />
          <DashboardGrid>
            <DashboardGrid.Item>
              <ChartCard title="Tổng nhân sự theo thời gian" isLoading>
                {null}
              </ChartCard>
            </DashboardGrid.Item>
            <DashboardGrid.Item>
              <ChartCard title="Nhân sự theo phòng ban" isLoading>
                {null}
              </ChartCard>
            </DashboardGrid.Item>
          </DashboardGrid>
        </>
      ) : isError || !data ? (
        <ChartCard title="Số liệu nhân sự" isError onRetry={() => void refetch()}>
          {null}
        </ChartCard>
      ) : (
        <>
          <StaffKpis dashboard={data} />
          <DashboardGrid>
            <DashboardGrid.Item>
              <TrendCard
                trend={data.trend}
                period={period}
                joined={data.staffChanges.joined}
                left={data.staffChanges.left}
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

      <StaffEmployees />
    </div>
  );
}

function PeriodSelect({ value, onChange }: { value: DashboardPeriod; onChange: (period: DashboardPeriod) => void }) {
  return (
    <Select
      aria-label="Kỳ thống kê"
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
            <ListBox.Item key={p} id={p} textValue={periodLabels[p]}>
              {periodLabels[p]}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function StaffKpis({ dashboard: { gender, staffChanges } }: { dashboard: StaffDashboardDto }) {
  const slices = toGenderSlices(gender);
  const male = slices.find((s) => s.key === "male")!;
  const female = slices.find((s) => s.key === "female")!;
  const net = staffChanges.joined - staffChanges.left;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        id="total"
        label="Tổng nhân sự"
        value={formatCount(gender.total)}
        chip={{
          text: net === 0 ? "0" : `${net > 0 ? "↑ +" : "↓ −"}${formatCount(Math.abs(net))}`,
          color: net > 0 ? "success" : net < 0 ? "danger" : "default",
        }}
      />
      <KpiCard id="male" label="Nam" value={formatCount(male.count)} chip={{ text: formatPercent(male.percent) }} />
      <KpiCard id="female" label="Nữ" value={formatCount(female.count)} chip={{ text: formatPercent(female.percent) }} />
      <KpiCard id="joined" label="Vào làm" value={formatCount(staffChanges.joined)} />
      <KpiCard id="left" label="Nghỉ việc" value={formatCount(staffChanges.left)} />
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div role="status" aria-label="Đang tải số liệu" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <Card key={i} className="gap-4">
          <Skeleton className="h-4 w-1/2 rounded-md" />
          <Skeleton className="h-7 w-1/3 rounded-md" />
        </Card>
      ))}
    </div>
  );
}
