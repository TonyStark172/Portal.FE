"use client";

import { Calendar } from "@gravity-ui/icons";
import { ListBox, Select } from "@heroui/react";
import type { DashboardPeriod } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { periodLabel } from "../../lib/format";

const PERIODS: DashboardPeriod[] = ["Month", "Quarter", "Year"];

/** The period an analytics tab sums up: this month, quarter or year. */
export function PeriodSelect({ value, onChange }: { value: DashboardPeriod; onChange: (period: DashboardPeriod) => void }) {
  const { t } = useLocale();
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
            <ListBox.Item key={p} id={p} textValue={periodLabel(p, t)}>
              {periodLabel(p, t)}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
