import type { EventInput } from "@fullcalendar/core";
import { BUSINESS_OFFSET_MS } from "./businessTime";
import { limitPerDay, limitPerOverlap, type MoreItems } from "./calendarCapacity";
import { meetingState } from "./meetingState";
import type { Meeting } from "./meetingTypes";

/** FullCalendar's UTC grid shows business wall-clock times: an instant moved by the business offset. */
export const calendarTime = (instant: string | Date) => new Date(new Date(instant).getTime() + BUSINESS_OFFSET_MS).toISOString();
/** The instant of a business wall-clock time read off the calendar. */
export const serverTime = (wallDate: Date) => new Date(wallDate.getTime() - BUSINESS_OFFSET_MS).toISOString();

/** A phone's month shows each meeting as a dot, and a compact "+N" beside its dots. */
export const showsDots = (view: string, isMobile: boolean) => isMobile && view === "dayGridMonth";

/**
 * How many entries a crowded day (month, list) or set of simultaneous meetings (week, day) keeps before "+N"
 * (`keep`: how many meetings stay when "+N" is shown; by default it takes the last of the `limit` places).
 */
export function capacityOf(view: string, isMobile: boolean): { per: "overlap" | "day"; limit: number; keep?: number } {
  if (view.startsWith("timeGrid")) return { per: "overlap", limit: 4 };
  if (view.startsWith("list")) return { per: "day", limit: 50 };
  // Dots leave room for "+N" beside them: a phone's day keeps up to 3 dots.
  if (showsDots(view, isMobile)) return { per: "day", limit: 3, keep: 3 };
  return { per: "day", limit: 5 };
}

export type MoreProps = { more: MoreItems<Meeting> };

/**
 * The events given to FullCalendar for `meetings` in `view`: each meeting, editable by its organizer, and a "+N" entry
 * for those a crowded day or time slot leaves out (opened as a list). All-day meetings fill their days in the time
 * grid, which has no all-day row. At `now` (an instant, ms), a meeting under way or over carries its state as a class,
 * "meeting-ongoing" or "meeting-finished" (globals.css), which the calendar also reads to draw and name it.
 */
export function calendarInputs(meetings: Meeting[], view: string, isMobile: boolean, userId: number | undefined, moreLabel: (count: number) => string, now?: number): EventInput[] {
  const timedGrid = view.startsWith("timeGrid");
  const capacity = capacityOf(view, isMobile);
  const { shown, more } = capacity.per === "overlap" ? limitPerOverlap(meetings, capacity.limit) : limitPerDay(meetings, capacity.limit, capacity.keep);
  // A dot is tapped to open its day, not dragged.
  const own = (meeting: Meeting) => userId !== undefined && meeting.organizerId === userId && !showsDots(view, isMobile);
  const stateClasses = (meeting: Meeting) => {
    const state = now === undefined ? "upcoming" : meetingState(meeting, now);
    return state === "upcoming" ? [] : [`meeting-${state}`];
  };
  return [
    ...shown.map((meeting): EventInput => ({
      id: String(meeting.id), title: `${meeting.title} · ${meeting.location}`,
      start: calendarTime(meeting.startUtc), end: calendarTime(meeting.endUtc), allDay: meeting.isAllDay && !timedGrid,
      editable: own(meeting), startEditable: own(meeting) && !(timedGrid && meeting.isAllDay), classNames: stateClasses(meeting),
      // Drawn in its own colour (`color`, set as --meeting-color when the event is mounted).
      extendedProps: { ...meeting },
    })),
    ...more.map((group): EventInput => {
      // A day's leftovers sit after its last shown meeting; simultaneous ones span the time they take.
      const end = timedGrid ? group.endUtc : new Date(Date.parse(group.startUtc) + 30 * 60000).toISOString();
      return {
        id: group.key, title: moreLabel(group.items.length), start: calendarTime(group.startUtc), end: calendarTime(end), allDay: false,
        editable: false, classNames: ["meeting-more"], extendedProps: { more: group } satisfies MoreProps,
      };
    }),
  ];
}
