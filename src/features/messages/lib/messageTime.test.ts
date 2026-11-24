import { expect, test } from "vitest";
import { dayKey, dayLabel, listTime } from "./messageTime";

const now = new Date(2026, 10, 23, 15, 0);
const at = (day: number, hour = 9, month = 10, year = 2026) => new Date(year, month, day, hour, 5).toISOString();
const labels = { today: "Hôm nay", yesterday: "Hôm qua" };

test("the list shows the time for today, the date before, and the year only for another year", () => {
  expect(listTime(at(23), "vi-VN", now)).toBe("09:05");
  expect(listTime(at(20), "vi-VN", now)).toBe("20/11");
  expect(listTime(at(20, 9, 10, 2025), "vi-VN", now)).toBe("20/11/2025");
});

test("days are named today and yesterday, then by their date", () => {
  expect(dayLabel(at(23), "vi-VN", labels, now)).toBe("Hôm nay");
  expect(dayLabel(at(22), "vi-VN", labels, now)).toBe("Hôm qua");
  expect(dayLabel(at(21), "vi-VN", labels, now)).toContain("21/11/2026");
});

test("two messages of the same local day share a day key, whatever the hour", () => {
  expect(dayKey(at(23, 0))).toBe(dayKey(at(23, 23)));
  expect(dayKey(at(23, 23))).not.toBe(dayKey(at(24, 0)));
});
