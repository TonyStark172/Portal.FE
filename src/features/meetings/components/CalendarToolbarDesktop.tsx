"use client";

import { Button } from "@heroui/react";
import { ChevronLeft, ChevronRight, LayoutCellsLarge, ListUl, Plus } from "@gravity-ui/icons";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import type { CalendarLayout } from "../meetingFilters";
import type { CalendarToolbarProps } from "./CalendarToolbar";
import { CalendarViewSwitch } from "./CalendarViewSwitch";
import { MeetingFilterBar } from "./MeetingFilterBar";

/**
 * A desktop's toolbar: the period, adding, the range tabs, the layout buttons and the navigation, then the filters in
 * a row. A tablet's has two rows (the period, its navigation and adding; then what is shown) and the filters behind
 * a funnel icon next to the layout buttons, so nothing wraps on its own between 768 and 1024px.
 */
export function CalendarToolbarDesktop({ tablet, title, range, layout, filters, kinds, busy, onRange, onLayout, onFilters, onPrevious, onNext, onToday, onAdd }: CalendarToolbarProps & { tablet: boolean }) {
  const { t } = useLocale();
  const layouts: [CalendarLayout, string, typeof ListUl][] = [["grid", t("meetings.gridLayout"), LayoutCellsLarge], ["list", t("meetings.listLayout"), ListUl]];
  const heading = <h2 aria-live="polite" className={`mr-auto text-xl font-semibold tracking-tight ${tablet ? "min-w-0 flex-1 truncate" : ""}`}>{title}</h2>;
  const add = (
    <div className="meeting-add flex flex-wrap items-center gap-2">
      <Button size="sm" aria-label={t("meetings.add")} isDisabled={busy} onPress={onAdd}><Plus className="size-4" />{t("meetings.add")}</Button>
    </div>
  );
  const views = <CalendarViewSwitch range={range} busy={busy} onChange={onRange} />;
  const layoutButtons = (
    <div role="group" aria-label={t("meetings.layout")} className="meeting-layout flex shrink-0 items-center gap-1">
      {layouts.map(([id, label, Icon]) => (
        <Button key={id} size="sm" isIconOnly variant={layout === id ? "secondary" : "ghost"} aria-label={label} aria-pressed={layout === id} isDisabled={busy}
          onPress={() => onLayout(id)}><Icon className="size-4" /></Button>
      ))}
    </div>
  );
  const navigation = (
    <div className="meeting-navigation flex shrink-0 items-center gap-1">
      <Button size="sm" variant="ghost" isIconOnly isDisabled={busy} aria-label={t("meetings.previous")} onPress={onPrevious}><ChevronLeft className="size-4" /></Button>
      <Button size="sm" variant="outline" isDisabled={busy} onPress={onToday}>{t("meetings.today")}</Button>
      <Button size="sm" variant="ghost" isIconOnly isDisabled={busy} aria-label={t("meetings.next")} onPress={onNext}><ChevronRight className="size-4" /></Button>
    </div>
  );
  if (tablet) return (
    <div className="meeting-toolbar mb-4 flex flex-col gap-3">
      <div className="meeting-toolbar-row flex min-w-0 items-center gap-3">{heading}{navigation}{add}</div>
      <div className="meeting-toolbar-row flex min-w-0 items-center gap-3">
        {views}
        {/* The filters sit with the layout buttons: one group of icons for what is shown. */}
        <div className="flex shrink-0 items-center gap-1">
          {layoutButtons}
          <MeetingFilterBar filters={filters} kinds={kinds} disabled={busy} variant="popover" onChange={onFilters} />
        </div>
      </div>
    </div>
  );
  return (
    <>
      <div className="meeting-toolbar mb-5 flex flex-wrap items-center gap-3">{heading}{add}{views}{layoutButtons}{navigation}</div>
      <div className="meeting-filter-row mb-4">
        <MeetingFilterBar filters={filters} kinds={kinds} disabled={busy} onChange={onFilters} />
      </div>
    </>
  );
}
