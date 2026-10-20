import { foldVietnamese } from "@/shared/lib/vietnameseSearch";
import { businessDate } from "./meetingForm";
import type { Meeting } from "./meetingTypes";

/**
 * What the sidebar lists and hides as one: a series ("s" + its id, every occurrence with it) or a meeting on its own
 * ("m" + its id). The calendar URL keeps the hidden ones by these keys.
 */
export const meetingKey = (meeting: Pick<Meeting, "id" | "seriesId">) => meeting.seriesId != null ? `s${meeting.seriesId}` : `m${meeting.id}`;

/** The meetings not hidden (by their keys); `meetings` itself when none is. */
export function visibleMeetings<T extends Pick<Meeting, "id" | "seriesId">>(meetings: T[], hidden: readonly string[]): T[] {
  if (!hidden.length) return meetings;
  const keys = new Set(hidden);
  return meetings.filter(meeting => !keys.has(meetingKey(meeting)));
}

/** A row of the sidebar's list: a meeting, or a series at its first occurrence in the range. */
export type MeetingRow = { key: string; title: string; location: string; color: string; startUtc: string; endUtc: string; isAllDay: boolean };

/**
 * The sidebar's list: one row per meeting or series in `meetings`, sorted by its first start, narrowed by `search`
 * (in the title or the place, ignoring case and accents).
 */
export function meetingRows(meetings: Meeting[], search: string): MeetingRow[] {
  const typed = foldVietnamese(search);
  const rows = new Map<string, MeetingRow>();
  for (const meeting of [...meetings].sort((a, b) => a.startUtc.localeCompare(b.startUtc) || a.id - b.id)) {
    const key = meetingKey(meeting);
    if (rows.has(key)) continue;
    if (typed && !foldVietnamese(meeting.title).includes(typed) && !foldVietnamese(meeting.location).includes(typed)) continue;
    const { title, location, color, startUtc, endUtc, isAllDay } = meeting;
    rows.set(key, { key, title, location, color, startUtc, endUtc, isAllDay });
  }
  return [...rows.values()];
}

const dayMs = 24 * 3600000;

/** The business days (yyyy-mm-dd) that hold part of a meeting; one ending at a midnight leaves that day out. */
export function meetingDays(meetings: Pick<Meeting, "startUtc" | "endUtc">[]): Set<string> {
  const days = new Set<string>();
  for (const meeting of meetings) {
    const start = Date.parse(meeting.startUtc);
    const last = Math.max(start, Date.parse(meeting.endUtc) - 1);
    // Day by day at the same business time from the start, then the day of the last instant.
    for (let time = start; time <= last; time += dayMs) days.add(businessDate(new Date(time)));
    days.add(businessDate(new Date(last)));
  }
  return days;
}
