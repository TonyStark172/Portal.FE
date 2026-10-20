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
  /** A desktop's sidebar (MeetingSidebar): whether it is open, its id and the button that opens or folds it away. */
  sidebar?: { open: boolean; controls: string; onToggle: () => void };
};

/**
 * The toolbar of the screen's size: a phone's (upright or sideways), a tablet's or a desktop's; a desktop whose
 * sidebar leaves the calendar narrow (`narrow`) lays its toolbar out as a tablet's, so it does not wrap.
 */
export function CalendarToolbar({ size, landscape, narrow = false, ...props }: CalendarToolbarProps & { size: ScreenSize; landscape: boolean; narrow?: boolean }) {
  return size === "phone" ? <CalendarToolbarPhone {...props} landscape={landscape} /> : <CalendarToolbarDesktop {...props} tablet={size === "tablet" || narrow} />;
}
