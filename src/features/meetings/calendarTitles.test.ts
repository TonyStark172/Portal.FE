import { expect, test } from "vitest";
import { compactTitle } from "./calendarTitles";

const day = (month: number, date: number, year = 2026) => new Date(Date.UTC(year, month - 1, date));
const month = { "vi-VN": "Tháng {month}, {year}", "en-US": "{month}/{year}" };

test.each([
  ["vi-VN", "dayGridMonth", day(10, 1), day(11, 1), "Tháng 10, 2026"],
  ["vi-VN", "listMonth", day(10, 1), day(11, 1), "Tháng 10, 2026"],
  ["vi-VN", "timeGridWeek", day(10, 12), day(10, 19), "12–18 Th10"],
  ["vi-VN", "listWeek", day(9, 28), day(10, 5), "28 Th9–4 Th10"],
  ["vi-VN", "timeGridDay", day(10, 12), day(10, 13), "T2, 12 Th10"],
  ["en-US", "dayGridMonth", day(10, 1), day(11, 1), "10/2026"],
  ["en-US", "timeGridWeek", day(10, 12), day(10, 19), "Oct 12–18"],
  ["en-US", "listDay", day(10, 12), day(10, 13), "Mon, Oct 12"],
] as const)("in %s the %s from %s reads short", (locale, type, start, end, title) => {
  expect(compactTitle(type, start, end, locale, month[locale])).toBe(title);
});
