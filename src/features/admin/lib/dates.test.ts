import { expect, test } from "vitest";
import { todayAsDateInput } from "./dates";

test("a day is written in the local time zone, not in UTC", () => {
  // Half past midnight local time is still the previous day in UTC for anyone east of Greenwich (Vietnam is UTC+7).
  expect(todayAsDateInput(new Date(2026, 9, 15, 0, 30))).toBe("2026-10-15");
  // And a late evening is already the next day in UTC for anyone west of it.
  expect(todayAsDateInput(new Date(2026, 9, 15, 23, 30))).toBe("2026-10-15");
});

test("month and day are padded to two digits", () => {
  expect(todayAsDateInput(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
});
