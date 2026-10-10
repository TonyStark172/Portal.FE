import { expect, test, vi } from "vitest";
import { createTimeChangeHandler, canMoveMeeting, meetingRequest, type MeetingEvent } from "./calendarEvents";
import { occurrenceUpdate } from "./meetingApi";

const allDayGrid = (start = "2030-01-07T00:00:00Z", end = "2030-01-07T23:00:00Z"): MeetingEvent => ({
  id: "7", start: new Date(start), end: new Date(end), allDay: false,
  extendedProps: { organizerId: 2, isAllDay: true, version: 4, seriesVersion: 9, title: "Họp", kind: "Nội bộ", location: "501", participantIds: [3] },
});

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
  const handler = createTimeChangeHandler({ save: async event => { saved.push(occurrenceUpdate(event, "m")); }, onPending: vi.fn(), onError: vi.fn(), onSaved: vi.fn() });
  await handler({ event: allDayGrid(start, end), revert }, 2, "resize");
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ scope: "occurrence", expectedVersion: 4, expectedSeriesVersion: 9, details: { participantIds: null, audience: null, schedule: { startUtc, endUtc, isAllDay, recurrence: null } } });
  expect(revert).not.toHaveBeenCalled();
});

test("reverts a conflicting all-day resize without changing its original kind", async () => {
  const event = allDayGrid();
  const revert = vi.fn();
  const errors: (string | null)[] = [];
  const handler = createTimeChangeHandler({ save: async () => { throw new Error("Trùng phòng"); }, onPending: vi.fn(), onError: message => errors.push(message), onSaved: vi.fn() });
  await handler({ event, revert }, 2, "resize");
  expect(revert).toHaveBeenCalledOnce();
  expect(errors).toContain("Trùng phòng");
  expect(event.extendedProps.isAllDay).toBe(true);
});

test("preserves structured conflict details and stale-version code for the form", async () => {
  vi.spyOn(window, "fetch").mockResolvedValue(Response.json({ code: "meetingConflict", detail: "Trùng", totalCount: 1, conflicts: [{ sequence: 1, locationConflict: true }] }, { status: 409 }));
  try { await meetingRequest("/api/Meetings/bookings", "token"); throw new Error("Expected rejection"); }
  catch (error) { expect(error).toMatchObject({ problem: { code: "meetingConflict", totalCount: 1, conflicts: [{ sequence: 1 }] } }); }
  vi.restoreAllMocks();
});
test("permits an existing all-day meeting to move without changing its all-day kind", () => {
  expect(canMoveMeeting({ id:"7", start:new Date("2030-01-07T00:00:00Z"), end:new Date("2030-01-08T00:00:00Z"), allDay:true, extendedProps:{organizerId:2,isAllDay:true} }, 2, false)).toBe(true);
});

const event = () => ({ id: "7", start: new Date("2026-10-12T02:00:00Z"), end: new Date("2026-10-12T03:00:00Z"), allDay: false, extendedProps: { organizerId: 2 } });

test("interactive sample movement stays local without saving or refetching", async () => {
  const effects:string[]=[];
  const handler=createTimeChangeHandler({save:async()=>{effects.push("save");},onPending:()=>effects.push("pending"),onError:()=>effects.push("error"),onSaved:()=>effects.push("saved"),onSettled:()=>effects.push("refetch")});
  await handler({event:{...event(),id:"preview-overlap-1",extendedProps:{preview:true,previewInteractive:true}},revert:()=>effects.push("revert")},undefined);
  expect(effects).toEqual([]);
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

test.each([new Error("network"), new Error("conflict")])("reverts a failed time change and releases the saving lock: %s", async (error) => {
  const revert = vi.fn();
  const pending = vi.fn();
  const report = vi.fn();
  const saved = vi.fn();
  const handler = createTimeChangeHandler({ save: async () => { throw error; }, onPending: pending, onError: report, onSaved: saved });
  await handler({ event: event(), revert }, 2);
  expect(revert).toHaveBeenCalledOnce();
  expect(report).toHaveBeenCalledWith(error.message);
  expect(pending.mock.calls).toEqual([[true], [false]]);
  expect(saved).not.toHaveBeenCalled();
});

test("saves once and reverts a second change while the first is pending", async () => {
  let finish!: () => void;
  const save = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  const saved = vi.fn();
  const handler = createTimeChangeHandler({ save, onPending: vi.fn(), onError: vi.fn(), onSaved: saved });
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
  const handler = createTimeChangeHandler({ save, onPending: vi.fn(), onError: vi.fn(), onSaved: vi.fn() });
  await handler({ event: event(), revert }, 3);
  expect(save).not.toHaveBeenCalled();
  expect(revert).toHaveBeenCalledOnce();
});

test("reconciles with the server after an ambiguous failed response", async () => {
  const order: string[] = [];
  const handler = createTimeChangeHandler({
    save: async () => { throw new Error("Response lost after commit"); },
    onPending: vi.fn(), onError: vi.fn(), onSaved: vi.fn(),
    onSettled: () => { order.push("refetch"); },
  });
  await handler({ event: event(), revert: () => { order.push("revert"); } }, 2);
  expect(order).toEqual(["revert", "refetch"]);
});

test("does not expose server stacktraces", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => new Response("System.InvalidOperationException: secret", { status: 500 }));
  await expect(meetingRequest("/api/Meetings", "token")).rejects.toThrow("Đã có lỗi xảy ra. Vui lòng thử lại.");
  vi.restoreAllMocks();
});

test("preserves actionable conflict messages instead of misreporting every conflict as double-booking", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ code: "conflict", detail: "Người tham gia không tồn tại." }, { status: 409 }));
  await expect(meetingRequest("/api/Meetings/7", "token", { method: "PUT" })).rejects.toThrow("Người tham gia không tồn tại.");
  vi.restoreAllMocks();
});
