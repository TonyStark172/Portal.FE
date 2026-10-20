import { expect, test } from "vitest";
import type { Meeting } from "@/features/meetings/meetingTypes";
import { calendarEntries, dayGroupOf, entryCount, needsAllDayRow, occasionDays, occasionTitle } from "./calendarEntries";
import type { CompanyEvent, Occasion, PublicHoliday } from "./eventTypes";
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
const holiday = (date: string, endDate: string, name: PublicHoliday = "LunarNewYear"): Occasion => ({ kind: "Holiday", date, endDate, holiday: name });
const company = (years: number, date = "2026-10-14"): Occasion => ({ kind: "CompanyAnniversary", date, years, organizationName: "AnNV" });
const t = (key: string) => translate(key, "vi-VN");
const en = (key: string) => translate(key, "en-US");
const options = (view: string, isMobile = false, now?: number) => ({
  view, isMobile, userId: 2, now, moreLabel: (count: number) => `+${count}`, occasionTitle: (occasion: Occasion) => occasionTitle(occasion, t),
});

test("an occasion reads as a birthday, a public holiday or the company's birthday, in Vietnamese and English", () => {
  expect(occasionTitle(birthday(1), t)).toBe("Sinh nhật Người 1");
  expect(occasionTitle(birthday(1), en)).toBe("Người 1's birthday");
  const names = (["NewYear", "LunarNewYear", "HungKings", "Reunification", "LabourDay", "NationalDay"] as const)
    .map(name => [occasionTitle(holiday("2026-01-01", "2026-01-01", name), t), occasionTitle(holiday("2026-01-01", "2026-01-01", name), en)]);
  expect(names).toEqual([
    ["Tết Dương lịch", "New Year's Day"], ["Tết Nguyên đán", "Lunar New Year (Tết)"], ["Giỗ Tổ Hùng Vương", "Hung Kings' Commemoration"],
    ["Ngày Giải phóng miền Nam", "Reunification Day"], ["Quốc tế Lao động", "International Labour Day"], ["Quốc khánh", "National Day"],
  ]);
  expect(occasionTitle(company(5), t)).toBe("Sinh nhật AnNV · 5 năm");
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(years => occasionTitle(company(years), en))).toEqual([
    "AnNV's 1st birthday", "AnNV's 2nd birthday", "AnNV's 3rd birthday", "AnNV's 4th birthday", "AnNV's 11th birthday", "AnNV's 12th birthday",
    "AnNV's 13th birthday", "AnNV's 21st birthday", "AnNV's 22nd birthday", "AnNV's 23rd birthday", "AnNV's 101st birthday", "AnNV's 111th birthday",
  ]);
});

test("a holiday is one all-day bar over its days, before the day's other occasions, never gathered behind '+N'", () => {
  // Tết 2027: the lunar new year's eve (Friday 5 February) through mùng 4 (Tuesday 9 February).
  const tet = holiday("2027-02-05", "2027-02-09");
  expect(occasionDays(tet)).toEqual(["2027-02-05", "2027-02-06", "2027-02-07", "2027-02-08", "2027-02-09"]);
  const inputs = calendarEntries([], [], [tet, birthday(1, "2027-02-06"), birthday(2, "2027-02-06"), birthday(3, "2027-02-06")], options("dayGridMonth"));
  const bar = inputs.find(input => input.id === "occasion:Holiday:LunarNewYear:2027-02-05")!;
  expect(bar).toMatchObject({ title: "Tết Nguyên đán", start: "2027-02-05", end: "2027-02-10", allDay: true, editable: false });
  expect(bar.classNames).toEqual(expect.arrayContaining(["calendar-occasion", "occasion-holiday"]));
  // The day's birthdays are gathered as before (one kept, "+2"), the holiday aside.
  const day6 = inputs.filter(input => input.start === "2027-02-06");
  expect(day6.map(input => input.title)).toEqual(["Sinh nhật Người 1", "+2"]);
  expect(bar.extendedProps!.order).toBeLessThan(day6[0].extendedProps!.order);
  // The company's birthday comes after a holiday and before people's.
  const [companyLine] = calendarEntries([], [], [company(5, "2027-02-06")], options("dayGridMonth"));
  expect(companyLine.classNames).toContain("occasion-company");
  expect(companyLine.extendedProps!.order).toBeGreaterThan(bar.extendedProps!.order);
  expect(companyLine.extendedProps!.order).toBeLessThan(day6[0].extendedProps!.order);
});

test("a holiday under way takes a deeper tone (no 'live' state); one that is over is faded", () => {
  const tet = holiday("2026-10-13", "2026-10-15");
  const [ongoing] = calendarEntries([], [], [tet], options("dayGridMonth", false, Date.parse(at(14, 10))));
  expect(ongoing.classNames).toContain("occasion-ongoing");
  expect(ongoing.classNames).not.toContain("meeting-ongoing");
  const [finished] = calendarEntries([], [], [tet], options("dayGridMonth", false, Date.parse(at(16, 10))));
  expect(finished.classNames).toContain("meeting-finished");
  const [upcoming] = calendarEntries([], [], [tet], options("dayGridMonth", false, Date.parse(at(12, 10))));
  expect(upcoming.classNames).not.toContain("meeting-finished");
  expect(upcoming.classNames).not.toContain("occasion-ongoing");
});

test("a phone's month shows a holiday's dot on each of its days, and a day opened lists it", () => {
  const inputs = calendarEntries([], [], [holiday("2026-10-13", "2026-10-15"), birthday(4)], options("dayGridMonth", true));
  const dots = inputs.filter(input => input.extendedProps?.occasion?.kind === "Holiday");
  expect(dots.map(input => input.start)).toEqual(["2026-10-13", "2026-10-14", "2026-10-15"]);
  expect(new Set(dots.map(input => input.id)).size).toBe(3);
  expect(dots.every(input => (input.classNames as string[]).includes("occasion-holiday"))).toBe(true);
  const group = dayGroupOf(inputs.map(input => input.extendedProps!), "2026-10-14")!;
  expect(group.occasions.map(occasion => occasion.kind)).toEqual(["Holiday", "Birthday"]);
  expect(dayGroupOf(inputs.map(input => input.extendedProps!), "2026-10-15")!.occasions.map(occasion => occasion.kind)).toEqual(["Holiday"]);
});

test("a company event is drawn by its category, read-only, all day in the all-day row", () => {
  const [timed, allDay] = calendarEntries([], [companyEvent(1), companyEvent(2, { isAllDay: true, category: "Sports", startUtc: at(14, 0), endUtc: at(15, 0), location: "Hội trường" })], [], options("timeGridWeek"));
  expect(timed).toMatchObject({ id: "event:1", title: "Sự kiện 1", allDay: false, editable: false, startEditable: false, durationEditable: false });
  expect(timed.classNames).toEqual(expect.arrayContaining(["company-event", "event-training"]));
  expect(allDay).toMatchObject({ id: "event:2", title: "Sự kiện 2 · Hội trường", allDay: true, start: "2026-10-14T00:00:00.000Z", end: "2026-10-15T00:00:00.000Z" });
  expect(allDay.classNames).toContain("event-sports");
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
  const inputs = calendarEntries([], [], [birthday(1), birthday(2), birthday(3), birthday(4, "2026-10-15"), birthday(5, "2026-10-15")], options("dayGridMonth"));
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
  expect(group.occasions.map(item => item.kind === "Birthday" && item.userId)).toEqual([4, 5]);
  expect(dayGroupOf(inputs.map(input => input.extendedProps!), "2026-10-20")).toBeNull();
});
