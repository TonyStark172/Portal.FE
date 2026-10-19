import { expect, test } from "vitest";
import { meetingDays, meetingKey, meetingRows, visibleMeetings } from "./meetingList";
import type { Meeting } from "./meetingTypes";

/** A meeting at `hour` (business time) on 2026-10-`day`, optionally an occurrence of series `seriesId`. */
const meeting = (id: number, day: number, hour: number, extra: Partial<Meeting> = {}): Meeting => ({
  id, title: `Họp ${id}`, kindId: 1, kind: "Nội bộ", location: "501", organizerId: 2, participantCount: 3, status: "Scheduled", color: "#AB3030",
  startUtc: new Date(Date.UTC(2026, 9, day, hour - 7)).toISOString(), endUtc: new Date(Date.UTC(2026, 9, day, hour - 6)).toISOString(),
  isAllDay: false, isException: false, version: 1, seriesSchedule: null, ...extra,
});

test("a meeting on its own and a series are told apart by their key", () => {
  expect(meetingKey(meeting(7, 12, 9))).toBe("m7");
  expect(meetingKey(meeting(8, 12, 9, { seriesId: 3 }))).toBe("s3");
});

test("the list has one row per meeting or series, sorted by its first start in the range", () => {
  const meetings = [
    meeting(1, 14, 9, { title: "Giao ban", seriesId: 5, color: "#27B450" }),
    meeting(2, 12, 15, { title: "Đối tác" }),
    meeting(3, 13, 9, { title: "Giao ban", seriesId: 5, color: "#27B450" }),
    meeting(4, 12, 8, { title: "Phỏng vấn" }),
  ];

  const rows = meetingRows(meetings, "");

  expect(rows.map(row => row.key)).toEqual(["m4", "m2", "s5"]);
  // A series is listed at its first occurrence in the range, in its colour.
  expect(rows[2]).toMatchObject({ title: "Giao ban", color: "#27B450", startUtc: meetings[2].startUtc });
});

test("a search narrows the list by title or room, ignoring case and accents", () => {
  const meetings = [
    meeting(1, 12, 9, { title: "Họp giao ban", location: "Phòng 501" }),
    meeting(2, 12, 10, { title: "Phỏng vấn", location: "Phòng Đà Nẵng" }),
    meeting(3, 12, 11, { title: "Đào tạo", location: "Hội trường" }),
  ];

  expect(meetingRows(meetings, "GIAO").map(row => row.key)).toEqual(["m1"]);
  expect(meetingRows(meetings, "da nang").map(row => row.key)).toEqual(["m2"]);
  expect(meetingRows(meetings, "dao tao").map(row => row.key)).toEqual(["m3"]);
  expect(meetingRows(meetings, "  ").map(row => row.key)).toEqual(["m1", "m2", "m3"]);
});

test("hidden meetings and series are left out, every occurrence of a series with it", () => {
  const meetings = [meeting(1, 12, 9, { seriesId: 5 }), meeting(2, 13, 9, { seriesId: 5 }), meeting(3, 12, 10), meeting(4, 12, 11)];

  expect(visibleMeetings(meetings, ["s5", "m4"]).map(m => m.id)).toEqual([3]);
  expect(visibleMeetings(meetings, [])).toBe(meetings);
});

test("the days with a meeting, a meeting over several days marking each of them (business dates)", () => {
  const overnight = meeting(2, 20, 22, { endUtc: new Date(Date.UTC(2026, 9, 22, 10 - 7)).toISOString() });
  // All day on the 25th: midnight to midnight, the end not a day of its own.
  const allDay = meeting(3, 25, 0, { isAllDay: true, endUtc: new Date(Date.UTC(2026, 9, 26, -7)).toISOString() });
  // 06:30 business time is still the day before in UTC.
  const early = meeting(4, 28, 6);

  expect([...meetingDays([meeting(1, 12, 9), overnight, allDay, early])].sort())
    .toEqual(["2026-10-12", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-25", "2026-10-28"]);
});
