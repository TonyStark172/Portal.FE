import type { EventInput } from "@fullcalendar/core";
import { BUSINESS_OFFSET_MS } from "./businessTime";
import { limitPerDay, limitPerOverlap, type MoreItems } from "./calendarCapacity";
import type { Meeting } from "./meetingTypes";

/** FullCalendar's UTC grid shows business wall-clock times: an instant moved by the business offset. */
export const calendarTime = (instant: string | Date) => new Date(new Date(instant).getTime() + BUSINESS_OFFSET_MS).toISOString();
/** The instant of a business wall-clock time read off the calendar. */
export const serverTime = (wallDate: Date) => new Date(wallDate.getTime() - BUSINESS_OFFSET_MS).toISOString();

/** How many entries a crowded day (month, list) or set of simultaneous meetings (week, day) keeps before "+N". */
export function capacityOf(view: string, isMobile: boolean) {
  if (view.startsWith("timeGrid")) return { per: "overlap" as const, limit: 4 };
  if (view.startsWith("list")) return { per: "day" as const, limit: 50 };
  return { per: "day" as const, limit: isMobile ? 3 : 5 };
}

export type MoreProps = { more: MoreItems<Meeting> };

/**
 * The events given to FullCalendar for `meetings` in `view`: each meeting, editable by its organizer, and a "+N" entry
 * for those a crowded day or time slot leaves out (opened as a list). All-day meetings fill their days in the time
 * grid, which has no all-day row.
 */
export function calendarInputs(meetings: Meeting[], view: string, isMobile: boolean, userId: number | undefined, moreLabel: (count: number) => string): EventInput[] {
  const timedGrid = view.startsWith("timeGrid");
  const capacity = capacityOf(view, isMobile);
  const { shown, more } = capacity.per === "overlap" ? limitPerOverlap(meetings, capacity.limit) : limitPerDay(meetings, capacity.limit);
  const own = (meeting: Meeting) => userId !== undefined && meeting.organizerId === userId;
  return [
    ...shown.map((meeting): EventInput => ({
      id: String(meeting.id), title: `${meeting.title} · ${meeting.location}`,
      start: calendarTime(meeting.startUtc), end: calendarTime(meeting.endUtc), allDay: meeting.isAllDay && !timedGrid,
      editable: own(meeting), startEditable: own(meeting) && !(timedGrid && meeting.isAllDay),
      classNames: [`meeting-tone-${meeting.id % 4}`],
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
