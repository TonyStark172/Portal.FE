import { expect, test } from "vitest";
import { meetingState, rowStates } from "./meetingState";
import type { Meeting } from "./meetingTypes";

/** A business wall-clock time on 2026-10-`day` as an instant (UTC+7). */
const at = (day: number, hour: number, minute = 0) => Date.UTC(2026, 9, day, hour - 7, minute);
const iso = (time: number) => new Date(time).toISOString();
const meeting = (id: number, day: number, from: number, to: number, extra: Partial<Meeting> = {}): Meeting => ({
  id, title: `Họp ${id}`, kindId: 1, kind: "Nội bộ", location: "501", organizerId: 2, participantCount: 3, status: "Scheduled", color: "#AB3030",
  startUtc: iso(at(day, from)), endUtc: iso(at(day, to)), isAllDay: false, isException: false, version: 1, seriesSchedule: null, ...extra,
});

test("a meeting is upcoming before its start, ongoing from its start, finished from its end", () => {
  const nine = meeting(1, 14, 9, 10);
  expect(meetingState(nine, at(14, 8, 59))).toBe("upcoming");
  expect(meetingState(nine, at(14, 9))).toBe("ongoing");
  expect(meetingState(nine, at(14, 9, 59))).toBe("ongoing");
  expect(meetingState(nine, at(14, 10))).toBe("finished");
  expect(meetingState(nine, at(15, 8))).toBe("finished");
});

test("an all-day meeting is ongoing during its days and finished after them", () => {
  // 13–14 October, all day: from the 13th's business midnight to the 15th's (exclusive).
  const twoDays = meeting(2, 13, 0, 0, { isAllDay: true, endUtc: iso(at(15, 0)) });
  expect(meetingState(twoDays, at(12, 23, 59))).toBe("upcoming");
  expect(meetingState(twoDays, at(13, 0))).toBe("ongoing");
  expect(meetingState(twoDays, at(14, 23, 59))).toBe("ongoing");
  expect(meetingState(twoDays, at(15, 0))).toBe("finished");
});

test("a row of the sidebar is ongoing while one of its meetings is, finished once all are", () => {
  const series = { seriesId: 5 };
  const meetings = [
    meeting(1, 13, 9, 10, series), meeting(2, 14, 9, 10, series), meeting(3, 15, 9, 10, series),
    meeting(4, 14, 8, 9), meeting(5, 14, 15, 16),
  ];
  expect(Object.fromEntries(rowStates(meetings, at(14, 9, 30)))).toEqual({ s5: "ongoing", m4: "finished", m5: "upcoming" });
  // Between two occurrences a series is still to come; after the last, finished.
  expect(rowStates(meetings, at(14, 12)).get("s5")).toBe("upcoming");
  expect(rowStates(meetings, at(16, 0)).get("s5")).toBe("finished");
});
