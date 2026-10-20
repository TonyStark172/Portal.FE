import { BUSINESS_OFFSET_MS } from "./businessTime";
import { meetingProblem, mutationKey, type MeetingsClient } from "./meetingsClient";
import type { Meeting, MeetingEditRequest } from "./meetingTypes";

/** A calendar event as FullCalendar hands it back after a drag or resize (times are business wall-clock in UTC). */
export type MeetingEvent = {
  id: string;
  start: Date | null;
  end: Date | null;
  allDay: boolean;
  extendedProps: Partial<Meeting>;
};
type Change = { event: MeetingEvent; revert: () => void };
type Handlers = {
  save: (event: MeetingEvent) => Promise<void>;
  onPending: (pending: boolean) => void;
  onError: (message: string | null) => void;
  onSaved: () => void;
  onSettled?: () => void;
  messages: { busy: string; notAllowed: string; failed: string };
};
type TimeChangeOperation = "drop" | "resize";

const midnight = (date: Date) => date.getTime() % 86400000 === 0;

export function canMoveMeeting(event: MeetingEvent, userId: number | undefined, busy: boolean, operation: TimeChangeOperation = "drop"): boolean {
  const resizingAllDayInTimeGrid = operation === "resize" && event.extendedProps.isAllDay === true && !event.allDay;
  return !busy && userId !== undefined && event.extendedProps.organizerId === userId &&
    (event.allDay === !!event.extendedProps.isAllDay || resizingAllDayInTimeGrid) && !!event.start && !!event.end &&
    Number.isFinite(event.start.getTime()) && Number.isFinite(event.end.getTime()) &&
    event.end.getTime() - event.start.getTime() >= 15 * 60000 &&
    (!event.allDay || midnight(event.start) && midnight(event.end));
}

/** Saves a dragged or resized meeting, one at a time; a refused or failed change goes back where it was. */
export function createTimeChangeHandler(handlers: Handlers) {
  let busy = false;
  return async (change: Change, userId: number | undefined, operation: TimeChangeOperation = "drop"): Promise<void> => {
    if (!canMoveMeeting(change.event, userId, busy, operation)) {
      change.revert();
      handlers.onError(busy ? handlers.messages.busy : handlers.messages.notAllowed);
      return;
    }
    busy = true;
    handlers.onPending(true);
    handlers.onError(null);
    try {
      const event = change.event;
      // The UTC calendar contains business wall-clock values, not UTC instants.
      // Keep full midnight-to-midnight spans all-day; partial spans become timed.
      // Copy instead of mutating EventApi, so revert still restores the original kind.
      const resizedAllDay = operation === "resize" && event.extendedProps.isAllDay && !event.allDay;
      const isAllDay = !!(resizedAllDay && midnight(event.start!) && midnight(event.end!));
      await handlers.save(resizedAllDay ? { ...event, id: event.id, start: event.start, end: event.end,
        allDay: isAllDay, extendedProps: { ...event.extendedProps, isAllDay } } : event);
    } catch (error) {
      change.revert();
      if (error instanceof Error && error.name === "AbortError") return;
      handlers.onError(error instanceof Error ? error.message : meetingProblem(error).detail ?? handlers.messages.failed);
      return;
    } finally {
      busy = false;
      handlers.onPending(false);
      handlers.onSettled?.();
    }
    // Refetch failures must not undo an update that the server has already committed.
    handlers.onSaved();
  };
}

/** The edit of one occurrence moved on the calendar: same details and people, new time. */
export function occurrenceUpdate(event: MeetingEvent, mutationId: string): MeetingEditRequest {
  const meeting = event.extendedProps;
  if (meeting.version === undefined || meeting.kindId === undefined || !event.start || !event.end) throw new Error("Missing meeting version, kind or time.");
  return {
    details: {
      title: meeting.title ?? "", kindId: meeting.kindId, location: meeting.location ?? "",
      schedule: {
        startUtc: new Date(event.start.getTime() - BUSINESS_OFFSET_MS).toISOString(),
        endUtc: new Date(event.end.getTime() - BUSINESS_OFFSET_MS).toISOString(),
        isAllDay: event.allDay, recurrence: null,
      },
      audience: null, participantIds: null, mutationId,
    },
    scope: "Occurrence", expectedVersion: meeting.version, expectedSeriesVersion: meeting.seriesVersion ?? null, replaceExceptions: false,
  };
}

/** Saves moved occurrences, keeping the mutation id while the same move is retried. */
export function createOccurrenceSaver() {
  let pending: { fingerprint: string; id: string } | null = null;
  return async (event: MeetingEvent, client: MeetingsClient) => {
    const request = occurrenceUpdate(event, "");
    pending = mutationKey(pending, { meetingId: event.id, request });
    request.details.mutationId = pending.id;
    await client.update(Number(event.id), request);
    pending = null;
  };
}
