"use client";

import type { ReactNode } from "react";
import { Button, Tooltip } from "@heroui/react";
import { Calendar, ChevronLeft, ChevronRight, LayoutCellsLarge, ListUl, Plus } from "@gravity-ui/icons";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import type { CalendarToolbarProps } from "./CalendarToolbar";
import { CalendarAddMenu } from "./CalendarAddMenu";
import { CalendarViewSwitch } from "./CalendarViewSwitch";
import { MeetingFilterBar } from "./MeetingFilterBar";

/**
 * A phone's toolbar, one row: the short period, then icons (each named, with a tooltip) — previous, next, today, the
 * other layout, the filters (a sheet from the bottom) and adding. The day / week / month switch floats at the bottom
 * of an upright phone; on a phone turned sideways, short of height, it sits in the row after the period.
 */
export function CalendarToolbarPhone({ landscape, shortTitle, range, layout, filters, kinds, busy, onRange, onLayout, onFilters, onPrevious, onNext, onToday, onAdd, onAddEvent }: CalendarToolbarProps & { landscape: boolean }) {
  const { t } = useLocale();
  const icon = (label: string, onPress: (() => void) | undefined, children: ReactNode, primary = false) => (
    <Tooltip delay={400}>
      <Button size="sm" variant={primary ? "primary" : "ghost"} isIconOnly className={`tap-target ${primary ? "meeting-add rounded-full" : ""}`} isDisabled={busy} aria-label={label} onPress={onPress}>{children}</Button>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
  // One button for the layout: it shows (and names) the one it switches to.
  const toList = layout === "grid";
  const views = <CalendarViewSwitch range={range} busy={busy} onChange={onRange} placement={landscape ? "toolbar" : "floating"} />;
  return (
    <>
      <div className="meeting-toolbar meeting-toolbar--phone">
        <h2 aria-live="polite" className="meeting-toolbar-title">{shortTitle}</h2>
        {landscape && views}
        <div className="meeting-toolbar-actions">
          {icon(t("meetings.previous"), onPrevious, <ChevronLeft className="size-4" />)}
          {icon(t("meetings.next"), onNext, <ChevronRight className="size-4" />)}
          {icon(t("meetings.today"), onToday, <Calendar className="size-4" />)}
          {icon(toList ? t("meetings.listLayout") : t("meetings.gridLayout"), () => onLayout(toList ? "list" : "grid"), toList ? <ListUl className="size-4" /> : <LayoutCellsLarge className="size-4" />)}
          <MeetingFilterBar filters={filters} kinds={kinds} disabled={busy} variant="sheet" onChange={onFilters} />
          {onAddEvent
            ? <CalendarAddMenu onAddMeeting={onAdd} onAddEvent={onAddEvent} trigger={icon(t("events.addMenu"), undefined, <Plus className="size-4" />, true)} />
            : icon(t("meetings.add"), onAdd, <Plus className="size-4" />, true)}
        </div>
      </div>
      {!landscape && views}
    </>
  );
}
