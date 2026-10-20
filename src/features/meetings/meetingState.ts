import { meetingKey } from "./meetingList";
import type { Meeting } from "./meetingTypes";

/** Where a meeting stands by the clock: still to come, under way (marked live), or over (faded, struck through). */
export type MeetingState = "upcoming" | "ongoing" | "finished";

/** How often the calendar looks at the clock again, so a meeting flips from ongoing to finished without a reload. */
export const MEETING_STATE_REFRESH_MS = 30_000;

/**
 * A meeting's state at `now` (an instant, ms): ongoing from its start, finished from its end. Its instants are real
 * ones, so the business offset does not matter; an all-day meeting runs from its first business midnight to the one
 * after its last day, so it is ongoing during its days and finished after them.
 */
export function meetingState(meeting: Pick<Meeting, "startUtc" | "endUtc">, now: number): MeetingState {
  if (Date.parse(meeting.endUtc) <= now) return "finished";
  return Date.parse(meeting.startUtc) <= now ? "ongoing" : "upcoming";
}

/**
 * The state of each row of the sidebar (meetingList.ts keys), from the meetings of the range: a series is ongoing
 * while one of its occurrences is, finished once all of them are, else still to come.
 */
export function rowStates(meetings: Pick<Meeting, "id" | "seriesId" | "startUtc" | "endUtc">[], now: number): Map<string, MeetingState> {
  const states = new Map<string, MeetingState>();
  for (const meeting of meetings) {
    const key = meetingKey(meeting);
    const state = meetingState(meeting, now);
    const known = states.get(key);
    if (!known || state === "ongoing" || (known === "finished" && state === "upcoming")) states.set(key, state);
  }
  return states;
}
