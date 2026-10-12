import { describe, expect, test } from "vitest";
import { translate } from "@/shared/i18n/locale";
import * as form from "./meetingForm";
import { noAudience, type Meeting, type MeetingFormValue, type RecurrenceRule } from "./meetingTypes";

const t = (key: string) => translate(key, "vi-VN");

const base: MeetingFormValue = {
  title: "Tập huấn", kind: "Nội bộ", location: "503", start: "2030-01-07T09:00", end: "2030-01-07T10:00", isAllDay: false,
  recurrence: null, audience: { ...noAudience, userIds: [2] }, scope: "Occurrence", replaceExceptions: false,
};

const meeting = (overrides: Partial<Meeting> = {}): Meeting => ({
  id: 1, title: "Old", kind: "Nội bộ", location: "503", startUtc: "2030-01-07T02:00:45.123Z", endUtc: "2030-01-07T03:00:45.123Z",
  organizerId: 2, participantCount: 2, status: "Scheduled", isAllDay: false, isException: false, version: 4, seriesSchedule: null,
  ...overrides,
});

const weekly = (weekdays: RecurrenceRule["weekdays"], until: string | null = null, count: number | null = 10): RecurrenceRule =>
  ({ frequency: "Weekly", interval: 1, weekdays, until, count });

test("serializes all-day inclusive dates to exclusive UTC+7 boundaries", () => {
  const request = form.toMeetingWriteRequest({ ...base, isAllDay: true, start: "2030-01-07", end: "2030-01-08" }, "mutation");
  expect(request.schedule).toMatchObject({ startUtc: "2030-01-06T17:00:00.000Z", endUtc: "2030-01-08T17:00:00.000Z", isAllDay: true });
});

test("rejects weekly recurrence without its anchor weekday and overlarge count", () => {
  expect(form.validateMeetingForm({ ...base, recurrence: { ...weekly(["Tuesday"]), count: 367 } }, t).recurrence).toBeTruthy();
});

test("explains missing calendar dates for monthly and yearly repeats", () => {
  expect(form.recurrenceSummary({ frequency: "Monthly", interval: 1, weekdays: [], count: 10, until: null }, t)).toContain("bỏ qua");
  expect(form.recurrenceSummary({ frequency: "Yearly", interval: 1, weekdays: [], count: 10, until: null }, t)).toContain("bỏ qua");
});

test.each(["Following", "Series"] as const)("%s edits restore a dragged exception's original weekly anchor", scope => {
  const moved = meeting({
    startUtc: "2030-01-16T02:00:00Z", endUtc: "2030-01-16T03:00:00Z", seriesId: 9, occurrenceKey: 1, isException: true,
    seriesSchedule: { startUtc: "2030-01-07T02:00:00Z", endUtc: "2030-01-07T03:00:00Z", isAllDay: false, recurrence: weekly(["Monday"]) },
  });
  const value = form.changeEditScope(form.fromMeeting(moved, noAudience), scope);
  expect(value.start).toBe("2030-01-14T09:00");
  expect(form.validateMeetingForm(value, t)).toEqual({});
  expect(Date.parse(form.toMeetingWriteRequest(value, "m").schedule.startUtc)).toBe(Date.parse("2030-01-14T02:00:00Z"));
  expect(form.changeEditScope(value, "Occurrence").start).toBe("2030-01-16T09:00");
});

test.each(["Following", "Series"] as const)("%s monthly anchors skip nonexistent dates and retain explicitly changed times", scope => {
  const moved = meeting({
    startUtc: "2030-04-03T02:00:00Z", endUtc: "2030-04-03T03:00:00Z", seriesId: 9, occurrenceKey: 1, isException: true,
    seriesSchedule: { startUtc: "2030-01-31T02:00:00Z", endUtc: "2030-01-31T03:00:00Z", isAllDay: false, recurrence: { frequency: "Monthly", interval: 1, weekdays: [], count: 10, until: null } },
  });
  expect(form.changeEditScope(form.fromMeeting(moved, noAudience), scope).start).toBe("2030-03-31T09:00");
  expect(form.changeEditScope({ ...form.fromMeeting(moved, noAudience), start: "2030-04-03T11:00" }, "Series").start).toBe("2030-04-03T11:00");
});

test("yearly preview counts actual leap dates beyond ten years for count rules", () => {
  expect(form.recurrenceDates("2032-02-29", { frequency: "Yearly", interval: 1, weekdays: [], count: 4, until: null }))
    .toEqual(["2032-02-29", "2036-02-29", "2040-02-29", "2044-02-29"]);
});

describe("editing a meeting", () => {
  test("keeps the stored instants and the people when only the title changes", () => {
    const saved = { ...noAudience, departmentIds: [5] };
    const value = form.fromMeeting(meeting(), saved);

    const request = form.toMeetingWriteRequest({ ...value, title: "New" }, "mutation");

    expect(request.schedule.startUtc).toBe("2030-01-07T02:00:45.123Z");
    expect(request.audience).toBeNull();
    expect(request.participantIds).toBeNull();
  });

  test("sends the people picked anew when they change (a department stays a department)", () => {
    const value = form.fromMeeting(meeting(), { ...noAudience, departmentIds: [5] });

    const request = form.toMeetingWriteRequest({ ...value, audience: { ...noAudience, departmentIds: [5, 6] } }, "mutation");

    expect(request.audience).toEqual({ ...noAudience, departmentIds: [5, 6] });
    expect(request.participantIds).toBeNull();
  });

  test("a meeting on its own becomes recurring by editing the whole series", () => {
    const single = form.fromMeeting(meeting(), noAudience);

    expect(form.editScopeOf(single)).toBe("Occurrence");
    expect(form.editScopeOf({ ...single, recurrence: weekly(["Monday"]) })).toBe("Series");
    expect(form.editScopeOf({ ...form.fromMeeting(meeting({ seriesId: 9 }), noAudience), scope: "Following" })).toBe("Following");
  });
});

describe("moving the start of a recurring meeting", () => {
  test("a weekly rule on the start's weekday follows it", () => {
    expect(form.reanchorRecurrence(weekly(["Monday"]), "2030-01-07T09:00", "2030-01-08T09:00")?.weekdays).toEqual(["Tuesday"]);
  });

  test("weekdays picked by hand stay as they are", () => {
    expect(form.reanchorRecurrence(weekly(["Monday", "Wednesday"]), "2030-01-07T09:00", "2030-01-09T09:00")?.weekdays)
      .toEqual(["Monday", "Wednesday"]);
  });

  test("an end date the start moves past keeps the series' length", () => {
    const rule = weekly(["Monday"], "2030-02-07", null);

    expect(form.reanchorRecurrence(rule, "2030-01-07T09:00", "2030-03-04T09:00")?.until).toBe("2030-04-04");
    expect(form.reanchorRecurrence(rule, "2030-01-07T09:00", "2030-01-14T09:00")?.until).toBe("2030-02-07");
  });

  test("the result is a valid rule for the new start", () => {
    const value = { ...base, start: "2030-01-08T09:00", end: "2030-01-08T10:00",
      recurrence: form.reanchorRecurrence(weekly(["Monday"]), "2030-01-07T09:00", "2030-01-08T09:00") };

    expect(form.validateMeetingForm(value, t)).toEqual({});
  });
});
