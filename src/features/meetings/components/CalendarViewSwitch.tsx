"use client";

import { Tabs } from "@heroui/react";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import type { CalendarRange } from "../meetingFilters";

type Props = { range: CalendarRange; busy: boolean; onChange: (range: CalendarRange) => void; placement?: "toolbar" | "floating" };

/**
 * Day / week / month. In a toolbar (wide screens, a phone turned sideways), or, on an upright phone, a segmented
 * control floating at the bottom of the screen (the calendar leaves room for it: `.meeting-calendar--floating-switch`).
 */
export function CalendarViewSwitch({ range, busy, onChange, placement = "toolbar" }: Props) {
  const { t } = useLocale();
  const ranges: [CalendarRange, string][] = [["day", t("meetings.day")], ["week", t("meetings.week")], ["month", t("meetings.month")]];
  const tabs = (
    <Tabs className={placement === "floating" ? "w-fit" : "meeting-view-switch w-fit max-w-full shrink-0"} selectedKey={range} onSelectionChange={key => onChange(key as CalendarRange)}>
      <Tabs.ListContainer>
        <Tabs.List aria-label={t("meetings.calendarView")}>
          {ranges.map(([id, label]) => <Tabs.Tab isDisabled={busy} className="w-auto shrink-0 whitespace-nowrap" key={id} id={id}>{label}<Tabs.Indicator /></Tabs.Tab>)}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
  return placement === "floating" ? <div className="meeting-view-switch meeting-view-switch--floating">{tabs}</div> : tabs;
}
