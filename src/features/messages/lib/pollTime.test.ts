import { describe, expect, test } from "vitest";
import { translate } from "@/shared/i18n/locale";
import { pollIsOver, pollRemaining, toLocalDateTime } from "./pollTime";

const t = (key: string) => translate(key, "vi-VN");
const now = Date.parse("2026-11-24T08:00:00Z");
const at = (ms: number) => new Date(now + ms).toISOString();
const MINUTE = 60_000;

describe("how long a poll still runs", () => {
  test("in days and hours, hours and minutes, or minutes rounded up", () => {
    expect(pollRemaining(at(2 * 24 * 60 * MINUTE + 3 * 60 * MINUTE + 10 * MINUTE), now, t)).toBe("Còn 2 ngày 3 giờ");
    expect(pollRemaining(at(24 * 60 * MINUTE), now, t)).toBe("Còn 1 ngày");
    expect(pollRemaining(at(4 * 60 * MINUTE + 15 * MINUTE), now, t)).toBe("Còn 4 giờ 15 phút");
    expect(pollRemaining(at(60 * MINUTE), now, t)).toBe("Còn 1 giờ");
    expect(pollRemaining(at(4 * MINUTE + 1_000), now, t)).toBe("Còn 5 phút");
  });

  test("rounds up to the next whole minute, so an hour less a second still reads one hour", () => {
    expect(pollRemaining(at(60 * MINUTE - 1_000), now, t)).toBe("Còn 1 giờ");
    expect(pollRemaining(at(24 * 60 * MINUTE - 1_000), now, t)).toBe("Còn 1 ngày");
    expect(pollRemaining(at(4 * 60 * MINUTE + 15 * MINUTE + 20_000), now, t)).toBe("Còn 4 giờ 16 phút");
  });

  test("says it ends soon in its last minute, and nothing once over", () => {
    expect(pollRemaining(at(30_000), now, t)).toBe("Sắp kết thúc");
    expect(pollRemaining(at(0), now, t)).toBe("");
    expect(pollRemaining(at(-MINUTE), now, t)).toBe("");
  });
});

describe("whether a poll is over", () => {
  test("once someone ends it or its deadline passes", () => {
    expect(pollIsOver({ closedAt: null, endsAt: null }, now)).toBe(false);
    expect(pollIsOver({ closedAt: null, endsAt: at(MINUTE) }, now)).toBe(false);
    expect(pollIsOver({ closedAt: null, endsAt: at(0) }, now)).toBe(true);
    expect(pollIsOver({ closedAt: at(-MINUTE), endsAt: at(MINUTE) }, now)).toBe(true);
  });
});

test("a local date and time is written as the date field reads it", () => {
  expect(toLocalDateTime(new Date(2026, 10, 5, 9, 7, 45))).toBe("2026-11-05T09:07:00");
});
