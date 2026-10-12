"use client";

import type { ScreenSize } from "@/shared/hooks/breakpoints";
import type { CalendarLayout, CalendarRange, MeetingFilters } from "../meetingFilters";
import type { MeetingKindDto } from "../meetingTypes";
import { CalendarToolbarDesktop } from "./CalendarToolbarDesktop";
import { CalendarToolbarPhone } from "./CalendarToolbarPhone";

/** What every toolbar shows and does; the calendar owns the state, the toolbars only lay it out. */
export type CalendarToolbarProps = {
  /** The period shown, in full ("12 – 18 thg 10, 2026") and short for a phone ("12–18 Th10"). */
  title: string;
  shortTitle: string;
  range: CalendarRange;
  layout: CalendarLayout;
  filters: MeetingFilters;
  kinds: MeetingKindDto[];
  busy: boolean;
  onRange: (range: CalendarRange) => void;
  onLayout: (layout: CalendarLayout) => void;
  onFilters: (filters: MeetingFilters) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onAdd: () => void;
};

/** The toolbar of the screen's size: a phone's (upright or sideways), a tablet's or a desktop's. */
export function CalendarToolbar({ size, landscape, ...props }: CalendarToolbarProps & { size: ScreenSize; landscape: boolean }) {
  return size === "phone" ? <CalendarToolbarPhone {...props} landscape={landscape} /> : <CalendarToolbarDesktop {...props} tablet={size === "tablet"} />;
}
