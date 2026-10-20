import { expect, test } from "vitest";
import { translate } from "@/shared/i18n/locale";
import type { Weekday } from "./meetingTypes";
import {
  businessHoursOf,
  fromWorkWeekForm,
  scrollTimeOf,
  summarizeWorkWeek,
  toWorkWeekForm,
  validateWorkWeekForm,
  type WorkDay,
  type WorkWeekForm,
} from "./workWeek";

const vi = (key: string) => translate(key, "vi-VN");
const en = (key: string) => translate(key, "en-US");

const day = (name: Weekday, start: string | null, end: string | null): WorkDay => ({ day: name, start, end });
/** Mon–Fri 08:00–17:00, Saturday morning, Sunday off — Sunday..Saturday as the API stores it. */
const withSaturday: WorkDay[] = [
  day("Sunday", null, null), day("Monday", "08:00", "17:00"), day("Tuesday", "08:00", "17:00"), day("Wednesday", "08:00", "17:00"),
  day("Thursday", "08:00", "17:00"), day("Friday", "08:00", "17:00"), day("Saturday", "08:00", "12:00"),
];
const defaultWeek: WorkDay[] = withSaturday.map(d => d.day === "Saturday" ? day("Saturday", null, null) : d);
const monToSat: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

test("toWorkWeekForm takes the range most chosen days share and keeps the others as their own hours", () => {
  expect(toWorkWeekForm(withSaturday)).toEqual({
    days: monToSat, start: "08:00", end: "17:00", overrides: { Saturday: { start: "08:00", end: "12:00" } },
  });
});

test("fromWorkWeekForm gives back the week the form was made from", () => {
  expect(fromWorkWeekForm(toWorkWeekForm(withSaturday))).toEqual(withSaturday);
  expect(fromWorkWeekForm(toWorkWeekForm(defaultWeek))).toEqual(defaultWeek);
});

test("a day taken out of the chosen days is a day off, its own hours dropped", () => {
  const form: WorkWeekForm = { ...toWorkWeekForm(withSaturday), days: monToSat.slice(0, 5) };
  expect(fromWorkWeekForm(form)).toEqual(defaultWeek);
});

test("summarizeWorkWeek lists the ranges and the days off in the reader's language", () => {
  expect(summarizeWorkWeek(withSaturday, vi)).toBe("T2–T6 08:00–17:00 · T7 08:00–12:00 · Nghỉ CN");
  expect(summarizeWorkWeek(withSaturday, en)).toBe("Mon–Fri 08:00–17:00 · Sat 08:00–12:00 · Sun off");
});

test("validateWorkWeekForm needs a working day and ranges that end after they start", () => {
  const form = toWorkWeekForm(withSaturday);
  expect(validateWorkWeekForm(form, vi)).toBeNull();
  expect(validateWorkWeekForm({ ...form, days: [] }, vi)).not.toBeNull();
  expect(validateWorkWeekForm({ ...form, end: "08:00" }, vi)).not.toBeNull();
  expect(validateWorkWeekForm({ ...form, overrides: { Saturday: { start: "12:00", end: "08:00" } } }, vi)).not.toBeNull();
});

test("the calendar shapes of a week: business hours grouped by range, scrolled to the earliest start", () => {
  expect(businessHoursOf(withSaturday)).toEqual([
    { daysOfWeek: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "17:00" },
    { daysOfWeek: [6], startTime: "08:00", endTime: "12:00" },
  ]);
  expect(scrollTimeOf(withSaturday)).toBe("08:00:00");
});
