import { expect, test } from "vitest";
import { formatDay, todayAsDateInput } from "./dates";

test("a day is written in the local time zone, not in UTC", () => {
  // Half past midnight local time is still the previous day in UTC for anyone east of Greenwich (Vietnam is UTC+7).
  expect(todayAsDateInput(new Date(2026, 9, 15, 0, 30))).toBe("2026-10-15");
  // And a late evening is already the next day in UTC for anyone west of it.
  expect(todayAsDateInput(new Date(2026, 9, 15, 23, 30))).toBe("2026-10-15");
});

test("month and day are padded to two digits", () => {
  expect(todayAsDateInput(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
});

test("a day from the API is written dd/MM/yyyy, or in the English style, whatever the time zone", () => {
  expect(formatDay("2026-01-05", "vi-VN")).toBe("05/01/2026");
  expect(formatDay("2026-10-15", "en-US")).toBe("Oct 15, 2026");
  // Not a day: given back as it came.
  expect(formatDay("soon", "vi-VN")).toBe("soon");
});
