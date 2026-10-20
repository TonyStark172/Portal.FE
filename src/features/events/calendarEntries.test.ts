import { expect, test } from "vitest";
import type { Meeting } from "@/features/meetings/meetingTypes";
import { calendarEntries, dayGroupOf, entryCount, needsAllDayRow, occasionTitle } from "./calendarEntries";
import type { CompanyEvent, Occasion } from "./eventTypes";
import { translate } from "@/shared/i18n/locale";

/** Business wall-clock `hour` on 2026-10-`day` as an instant (UTC+7). */
const at = (day: number, hour: number) => new Date(Date.UTC(2026, 9, day, hour - 7)).toISOString();
const meeting = (id: number, day: number, hour: number): Meeting => ({
  id, title: `Họp ${id}`, kindId: 1, kind: "Nội bộ", location: "501", organizerId: 2, participantCount: 3, status: "Scheduled", color: "#27B450",
  startUtc: at(day, hour), endUtc: at(day, hour + 1), isAllDay: false, isException: false, version: 1, seriesSchedule: null,
});
const companyEvent = (id: number, patch: Partial<CompanyEvent> = {}): CompanyEvent => ({
  id, title: `Sự kiện ${id}`, description: null, location: null, startUtc: at(14, 9), endUtc: at(14, 11), isAllDay: false,
  category: "Training", departments: [], createdById: 1, canManage: false, ...patch,
});
const birthday = (userId: number, date = "2026-10-14"): Occasion => ({ kind: "Birthday", date, userId, fullName: `Người ${userId}`, avatarUrl: null, departmentName: "Kỹ thuật" });
const anniversary = (userId: number, years: number, date = "2026-10-14"): Occasion => ({ ...birthday(userId, date), kind: "WorkAnniversary", years });
const t = (key: string) => translate(key, "vi-VN");
const options = (view: string, isMobile = false, now?: number) => ({
  view, isMobile, userId: 2, now, moreLabel: (count: number) => `+${count}`, occasionTitle: (occasion: Occasion) => occasionTitle(occasion, t),
});

test("an occasion reads as a birthday or as the years at the company", () => {
  expect(occasionTitle(birthday(1), t)).toBe("Sinh nhật Người 1");
  expect(occasionTitle(anniversary(1, 3), t)).toBe("3 năm · Người 1");
});

test("a company event is drawn by its category, read-only, all day in the all-day row", () => {
  const [timed, allDay] = calendarEntries([], [companyEvent(1), companyEvent(2, { isAllDay: true, category: "Deadline", startUtc: at(14, 0), endUtc: at(15, 0), location: "Hội trường" })], [], options("timeGridWeek"));
  expect(timed).toMatchObject({ id: "event:1", title: "Sự kiện 1", allDay: false, editable: false, startEditable: false, durationEditable: false });
  expect(timed.classNames).toEqual(expect.arrayContaining(["company-event", "event-training"]));
  expect(allDay).toMatchObject({ id: "event:2", title: "Sự kiện 2 · Hội trường", allDay: true, start: "2026-10-14T00:00:00.000Z", end: "2026-10-15T00:00:00.000Z" });
  expect(allDay.classNames).toContain("event-deadline");
  expect(allDay.extendedProps).toMatchObject({ companyEvent: { id: 2 }, isAllDay: true });
});

test("a company event carries its state by the clock, as a meeting does", () => {
  const now = Date.parse(at(14, 10));
  const [ongoing, finished, upcoming] = calendarEntries([], [
    companyEvent(1), companyEvent(2, { startUtc: at(14, 7), endUtc: at(14, 8) }), companyEvent(3, { startUtc: at(14, 14), endUtc: at(14, 15) }),
  ], [], options("timeGridWeek", false, now));
  expect(ongoing.classNames).toContain("meeting-ongoing");
  expect(finished.classNames).toContain("meeting-finished");
  expect(upcoming.classNames).not.toContain("meeting-finished");
  expect(upcoming.classNames).not.toContain("meeting-ongoing");
});

test("occasions are all-day lines; a grid day with many keeps one and gathers the rest behind '+N'", () => {
  const inputs = calendarEntries([], [], [birthday(1), anniversary(2, 3), birthday(3), birthday(4, "2026-10-15"), birthday(5, "2026-10-15")], options("dayGridMonth"));
  const day14 = inputs.filter(input => String(input.start).startsWith("2026-10-14"));
  expect(day14).toHaveLength(2);
  expect(day14[0]).toMatchObject({ allDay: true, editable: false, title: "Sinh nhật Người 1" });
  expect(day14[0].classNames).toContain("calendar-occasion");
  expect(day14[1]).toMatchObject({ title: "+2", allDay: true });
  expect(day14[1].extendedProps!.moreOccasions).toHaveLength(2);
  // The calendar orders them by `order`: the "+N" after the occasion it keeps.
  expect(day14[1].extendedProps!.order).toBeGreaterThan(day14[0].extendedProps!.order);
  // Two fit as they are.
  expect(inputs.filter(input => String(input.start).startsWith("2026-10-15")).map(input => input.title)).toEqual(["Sinh nhật Người 4", "Sinh nhật Người 5"]);
  // A list shows them all.
  expect(calendarEntries([], [], [birthday(1), birthday(2), birthday(3)], options("listWeek"))).toHaveLength(3);
});

test("an all-day row is needed for all-day events and occasions only", () => {
  expect(needsAllDayRow([companyEvent(1)], [])).toBe(false);
  expect(needsAllDayRow([companyEvent(1, { isAllDay: true })], [])).toBe(true);
  expect(needsAllDayRow([], [birthday(1)])).toBe(true);
});

test("a phone's month day keeps three dots in all, meetings, events and occasions together, and counts the rest", () => {
  const inputs = calendarEntries([meeting(1, 14, 9), meeting(2, 14, 10)], [companyEvent(3)], [birthday(4), birthday(5)], options("dayGridMonth", true));
  const more = inputs.filter(input => input.extendedProps?.more);
  expect(inputs).toHaveLength(4);
  expect(more).toHaveLength(1);
  expect(entryCount(more[0].extendedProps!)).toBe(2);
});

test("a phone's month day with three occasions shows three dots, without a second '+N'", () => {
  const inputs = calendarEntries([meeting(1, 14, 9)], [], [birthday(4), birthday(5), birthday(6)], options("dayGridMonth", true));
  expect(inputs.filter(input => input.extendedProps?.occasion)).toHaveLength(3);
  const more = inputs.filter(input => input.extendedProps?.more || input.extendedProps?.moreOccasions);
  expect(more).toHaveLength(1);
  expect(entryCount(more[0].extendedProps!)).toBe(1);
});

test("the day a phone opens lists its meetings, events and occasions, those behind '+N' too", () => {
  const inputs = calendarEntries([meeting(1, 14, 9), meeting(2, 14, 10), meeting(9, 16, 9)], [companyEvent(3)], [birthday(4), birthday(5)], options("dayGridMonth", true));
  const group = dayGroupOf(inputs.map(input => input.extendedProps!), "2026-10-14")!;
  expect(group.items.map(item => item.id)).toEqual([1, 2]);
  expect(group.events.map(item => item.id)).toEqual([3]);
  expect(group.occasions.map(item => item.userId)).toEqual([4, 5]);
  expect(dayGroupOf(inputs.map(input => input.extendedProps!), "2026-10-20")).toBeNull();
});
