import { describe, expect, test } from "vitest";
import { translate } from "@/shared/i18n/locale";
import { busiestIndex, formatAverage, formatHours, hourRange, meetingStepLabel, tintLevel } from "./meetingFormat";

const vi = (key: string) => translate(key, "vi-VN");
const en = (key: string) => translate(key, "en-US");

describe("meeting analytics formatting", () => {
  test("writes hours to one decimal at most, in the reader's language", () => {
    expect(formatHours(12.5, vi, "vi-VN")).toBe("12,5 giờ");
    expect(formatHours(12, vi, "vi-VN")).toBe("12 giờ");
    expect(formatHours(12.25, en, "en-US")).toBe("12.3 h");
  });

  test("writes the people per meeting to one decimal", () => {
    expect(formatAverage(4.5, "vi-VN")).toBe("4,5");
    expect(formatAverage(3, "vi-VN")).toBe("3,0");
  });

  test("labels a month's steps by the day each week starts, longer periods by month", () => {
    expect(meetingStepLabel({ from: "2026-10-08" }, "Month")).toBe("08/10");
    expect(meetingStepLabel({ from: "2026-10-01" }, "Quarter")).toBe("T10");
  });

  test("names an hour by the hour it covers", () => {
    expect(hourRange(9)).toBe("09:00–10:00");
    expect(hourRange(23)).toBe("23:00–24:00");
  });

  test("finds the busiest slot, the first on a tie, and none when there is no meeting", () => {
    expect(busiestIndex([2, 5, 1, 5])).toBe(1);
    expect(busiestIndex([0, 0])).toBe(-1);
  });

  test("tints by share of the busiest, in four steps over none", () => {
    expect([0, 1, 2, 3, 5].map((count) => tintLevel(count, 5))).toEqual([0, 1, 2, 3, 4]);
    expect(tintLevel(0, 0)).toBe(0);
  });
});
