import { businessDate } from "@/features/meetings/meetingForm";
import { meetingState } from "@/features/meetings/meetingState";
import type { Meeting } from "@/features/meetings/meetingTypes";
import type { BirthdayOccasion, Occasion } from "@/features/events/eventTypes";

/** How far ahead the home page's widgets look, in days from today. */
export const MEETINGS_DAYS_AHEAD = 7;
export const BIRTHDAYS_DAYS_AHEAD = 30;

/** The meetings under way and those still to come at `now` (an instant, ms), each by its start; those over are left out. */
export function currentMeetings<T extends Pick<Meeting, "id" | "startUtc" | "endUtc">>(meetings: T[], now: number) {
  const sorted = [...meetings].sort((a, b) => a.startUtc.localeCompare(b.startUtc) || a.id - b.id);
  return {
    ongoing: sorted.filter(meeting => meetingState(meeting, now) === "ongoing"),
    upcoming: sorted.filter(meeting => meetingState(meeting, now) === "upcoming"),
  };
}

/** The people's birthdays among the occasions (no holidays, nor the company's), in the order given: by day, then name. */
export const birthdaysOf = (occasions: Occasion[]) => occasions.filter((occasion): occasion is BirthdayOccasion => occasion.kind === "Birthday");

/** The business day (yyyy-mm-dd) of an instant (ms). */
export const businessDay = (now: number) => businessDate(new Date(now));
