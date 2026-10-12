import { expect, test, vi } from "vitest";
import { canMoveMeeting, createTimeChangeHandler, occurrenceUpdate, type MeetingEvent } from "./calendarEvents";

const messages = { busy: "busy", notAllowed: "not allowed", failed: "failed" };
const handlerWith = (overrides: Partial<Parameters<typeof createTimeChangeHandler>[0]> = {}) =>
  createTimeChangeHandler({ save: async () => {}, onPending: vi.fn(), onError: vi.fn(), onSaved: vi.fn(), messages, ...overrides });

const allDayGrid = (start = "2030-01-07T00:00:00Z", end = "2030-01-07T23:00:00Z"): MeetingEvent => ({
  id: "7", start: new Date(start), end: new Date(end), allDay: false,
  extendedProps: { organizerId: 2, isAllDay: true, version: 4, seriesVersion: 9, title: "Họp", kind: "Nội bộ", location: "501" },
});
const event = (): MeetingEvent => ({ id: "7", start: new Date("2026-10-12T02:00:00Z"), end: new Date("2026-10-12T03:00:00Z"), allDay: false, extendedProps: { organizerId: 2 } });

test("allows all-day to timed conversion only when resizing an owned meeting", () => {
  expect(canMoveMeeting(allDayGrid(), 2, false, "resize")).toBe(true);
  expect(canMoveMeeting(allDayGrid(), 2, false, "drop")).toBe(false);
  expect(canMoveMeeting(allDayGrid(), 3, false, "resize")).toBe(false);
  expect(canMoveMeeting(allDayGrid(), 2, true, "resize")).toBe(false);
  expect(canMoveMeeting(allDayGrid("2030-01-07T22:50:00Z"), 2, false, "resize")).toBe(false);
});

test.each([
  ["2030-01-07T00:00:00Z", "2030-01-07T23:00:00Z", false, "2030-01-06T17:00:00.000Z", "2030-01-07T16:00:00.000Z"],
  ["2030-01-07T01:00:00Z", "2030-01-08T00:00:00Z", false, "2030-01-06T18:00:00.000Z", "2030-01-07T17:00:00.000Z"],
  ["2030-01-07T00:00:00Z", "2030-01-08T00:00:00Z", true, "2030-01-06T17:00:00.000Z", "2030-01-07T17:00:00.000Z"],
])("resize stores correct business time and kind: %s to %s", async (start, end, isAllDay, startUtc, endUtc) => {
  const saved: ReturnType<typeof occurrenceUpdate>[] = [];
  const revert = vi.fn();
  await handlerWith({ save: async moved => { saved.push(occurrenceUpdate(moved, "m")); } })({ event: allDayGrid(start, end), revert }, 2, "resize");
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ scope: "Occurrence", expectedVersion: 4, expectedSeriesVersion: 9, details: { participantIds: null, audience: null, schedule: { startUtc, endUtc, isAllDay, recurrence: null } } });
  expect(revert).not.toHaveBeenCalled();
});

test("a drag updates only one occurrence, with its versions, keeping its people", () => {
  const request = occurrenceUpdate({ id: "7", start: new Date("2030-01-07T09:15:00Z"), end: new Date("2030-01-07T10:00:00Z"), allDay: false,
    extendedProps: { version: 4, seriesVersion: 9, title: "A", kind: "Nội bộ", location: "503" } }, "m");
  expect(request).toMatchObject({ scope: "Occurrence", expectedVersion: 4, expectedSeriesVersion: 9,
    details: { mutationId: "m", participantIds: null, audience: null, schedule: { recurrence: null, startUtc: "2030-01-07T02:15:00.000Z", endUtc: "2030-01-07T03:00:00.000Z" } } });
});

test("reverts a conflicting all-day resize without changing its original kind", async () => {
  const conflicting = allDayGrid();
  const revert = vi.fn();
  const errors: (string | null)[] = [];
  await handlerWith({ save: async () => { throw new Error("Trùng phòng"); }, onError: message => errors.push(message) })({ event: conflicting, revert }, 2, "resize");
  expect(revert).toHaveBeenCalledOnce();
  expect(errors).toContain("Trùng phòng");
  expect(conflicting.extendedProps.isAllDay).toBe(true);
});

test("a server's problem is shown as its message", async () => {
  const errors: (string | null)[] = [];
  await handlerWith({ save: async () => { throw { status: 409, data: { code: "meetingConflict", detail: "Trùng phòng 501" } }; }, onError: message => errors.push(message) })(
    { event: event(), revert: vi.fn() }, 2);
  expect(errors).toContain("Trùng phòng 501");
});

test("permits an existing all-day meeting to move without changing its all-day kind", () => {
  expect(canMoveMeeting({ id: "7", start: new Date("2030-01-07T00:00:00Z"), end: new Date("2030-01-08T00:00:00Z"), allDay: true, extendedProps: { organizerId: 2, isAllDay: true } }, 2, false)).toBe(true);
});

test("allows simultaneous meetings in different places (does not blanket-block overlaps)", () => {
  expect(canMoveMeeting(event(), 2, false)).toBe(true);
});

test("rejects non-organizers, all-day conversion, and durations below 15 minutes", () => {
  expect(canMoveMeeting(event(), 3, false)).toBe(false);
  expect(canMoveMeeting({ ...event(), allDay: true }, 2, false)).toBe(false);
  expect(canMoveMeeting({ ...event(), end: new Date("2026-10-12T02:14:00Z") }, 2, false)).toBe(false);
  expect(canMoveMeeting({ ...event(), end: null }, 2, false)).toBe(false);
});

test.each([new Error("network"), new Error("conflict")])("reverts a failed time change and releases the saving lock: %s", async error => {
  const revert = vi.fn();
  const pending = vi.fn();
  const report = vi.fn();
  const saved = vi.fn();
  await handlerWith({ save: async () => { throw error; }, onPending: pending, onError: report, onSaved: saved })({ event: event(), revert }, 2);
  expect(revert).toHaveBeenCalledOnce();
  expect(report).toHaveBeenCalledWith(error.message);
  expect(pending.mock.calls).toEqual([[true], [false]]);
  expect(saved).not.toHaveBeenCalled();
});

test("saves once and reverts a second change while the first is pending", async () => {
  let finish!: () => void;
  const save = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const saved = vi.fn();
  const handler = handlerWith({ save, onSaved: saved });
  const firstRevert = vi.fn();
  const first = handler({ event: event(), revert: firstRevert }, 2);
  const secondRevert = vi.fn();
  await handler({ event: event(), revert: secondRevert }, 2);
  expect(secondRevert).toHaveBeenCalledOnce();
  expect(save).toHaveBeenCalledTimes(1);
  finish();
  await first;
  expect(firstRevert).not.toHaveBeenCalled();
  expect(saved).toHaveBeenCalledOnce();
});

test("never submits an invalid or unauthorized change", async () => {
  const save = vi.fn();
  const revert = vi.fn();
  await handlerWith({ save })({ event: event(), revert }, 3);
  expect(save).not.toHaveBeenCalled();
  expect(revert).toHaveBeenCalledOnce();
});

test("reconciles with the server after an ambiguous failed response", async () => {
  const order: string[] = [];
  await handlerWith({ save: async () => { throw new Error("Response lost after commit"); }, onSettled: () => { order.push("refetch"); } })(
    { event: event(), revert: () => { order.push("revert"); } }, 2);
  expect(order).toEqual(["revert", "refetch"]);
});
