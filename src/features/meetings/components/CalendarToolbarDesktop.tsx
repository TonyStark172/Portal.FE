"use client";

import { Button, Tooltip } from "@heroui/react";
import { ChevronLeft, ChevronRight, LayoutSideContentLeft, Plus } from "@gravity-ui/icons";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import type { CalendarToolbarProps } from "./CalendarToolbar";
import { CalendarLayoutSwitch } from "./CalendarLayoutSwitch";
import { CalendarViewSwitch } from "./CalendarViewSwitch";
import { MeetingFilterBar } from "./MeetingFilterBar";

/**
 * A desktop's toolbar: the period, adding, the range tabs, the layout tabs and the navigation, then the filters in
 * a row. A tablet's has two rows (the period, its navigation and adding; then what is shown) and the filters behind
 * a funnel icon next to the layout tabs, so nothing wraps on its own between 768 and 1024px.
 */
export function CalendarToolbarDesktop({ tablet, title, range, layout, filters, kinds, busy, sidebar, onRange, onLayout, onFilters, onPrevious, onNext, onToday, onAdd }: CalendarToolbarProps & { tablet: boolean }) {
  const { t } = useLocale();
  // A desktop's sidebar is opened and folded away from the start of the toolbar, right of it.
  const sidebarLabel = sidebar?.open ? t("meetings.hideSidebar") : t("meetings.showSidebar");
  const sidebarToggle = sidebar && (
    <Tooltip delay={400}>
      <Button size="sm" variant="ghost" isIconOnly aria-label={sidebarLabel} aria-expanded={sidebar.open} aria-controls={sidebar.open ? sidebar.controls : undefined}
        className="meeting-sidebar-toggle -ml-1" onPress={sidebar.onToggle}><LayoutSideContentLeft className="size-4" /></Button>
      <Tooltip.Content>{sidebarLabel}</Tooltip.Content>
    </Tooltip>
  );
  const heading = <h2 aria-live="polite" className={`mr-auto text-xl font-semibold tracking-tight ${tablet ? "min-w-0 flex-1 truncate" : ""}`}>{title}</h2>;
  const add = (
    <div className="meeting-add flex flex-wrap items-center gap-2">
      <Button size="sm" aria-label={t("meetings.add")} isDisabled={busy} onPress={onAdd}><Plus className="size-4" />{t("meetings.add")}</Button>
    </div>
  );
  const views = <CalendarViewSwitch range={range} busy={busy} onChange={onRange} />;
  const layoutButtons = <CalendarLayoutSwitch layout={layout} busy={busy} onChange={onLayout} />;
  const navigation = (
    <div className="meeting-navigation flex shrink-0 items-center gap-1">
      <Button size="sm" variant="ghost" isIconOnly isDisabled={busy} aria-label={t("meetings.previous")} onPress={onPrevious}><ChevronLeft className="size-4" /></Button>
      <Button size="sm" variant="outline" isDisabled={busy} onPress={onToday}>{t("meetings.today")}</Button>
      <Button size="sm" variant="ghost" isIconOnly isDisabled={busy} aria-label={t("meetings.next")} onPress={onNext}><ChevronRight className="size-4" /></Button>
    </div>
  );
  if (tablet) return (
    <div className="meeting-toolbar mb-4 flex flex-col gap-3">
      <div className="meeting-toolbar-row flex min-w-0 items-center gap-3">{sidebarToggle}{heading}{navigation}{add}</div>
      <div className="meeting-toolbar-row flex min-w-0 items-center gap-3">
        {views}
        {/* The filters sit with the layout tabs: one group for what is shown. */}
        <div className="flex shrink-0 items-center gap-1">
          {layoutButtons}
          <MeetingFilterBar filters={filters} kinds={kinds} disabled={busy} variant="popover" onChange={onFilters} />
        </div>
      </div>
    </div>
  );
  return (
    <>
      <div className="meeting-toolbar mb-5 flex flex-wrap items-center gap-3">{sidebarToggle}{heading}{add}{views}{layoutButtons}{navigation}</div>
      <div className="meeting-filter-row mb-4">
        <MeetingFilterBar filters={filters} kinds={kinds} disabled={busy} onChange={onFilters} />
      </div>
    </>
  );
}
