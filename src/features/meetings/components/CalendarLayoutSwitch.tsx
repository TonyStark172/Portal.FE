"use client";

import { Tabs } from "@heroui/react";
import { LayoutCellsLarge, ListUl } from "@gravity-ui/icons";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import type { CalendarLayout } from "../meetingFilters";

type Props = { layout: CalendarLayout; busy: boolean; onChange: (layout: CalendarLayout) => void };

/**
 * Calendar or list, as tabs styled like the day / week / month ones beside them: an icon each, named for screen
 * readers. A desktop's and a tablet's toolbar; a phone keeps its single toggle button.
 */
export function CalendarLayoutSwitch({ layout, busy, onChange }: Props) {
  const { t } = useLocale();
  const layouts: [CalendarLayout, string, typeof ListUl][] = [
    ["grid", t("meetings.gridLayout"), LayoutCellsLarge],
    ["list", t("meetings.listLayout"), ListUl],
  ];
  return (
    <Tabs className="meeting-layout w-fit shrink-0" selectedKey={layout} onSelectionChange={key => onChange(key as CalendarLayout)}>
      <Tabs.ListContainer>
        <Tabs.List aria-label={t("meetings.layout")}>
          {layouts.map(([id, label, Icon]) => (
            <Tabs.Tab key={id} id={id} aria-label={label} isDisabled={busy} className="w-auto shrink-0 px-3">
              <Icon aria-hidden className="size-4" />
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}
