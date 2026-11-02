import { describe, expect, test } from "vitest";
import type { Occasion } from "@/features/events/eventTypes";
import { birthdaysOf, businessDay, currentMeetings } from "./homeWidgets";

const now = Date.parse("2026-11-02T03:00:00Z"); // 10:00 in business time
const meeting = (id: number, startUtc: string, endUtc: string) => ({ id, startUtc, endUtc });

describe("currentMeetings", () => {
  test("splits the meetings under way from those to come, and leaves out those over", () => {
    const over = meeting(1, "2026-11-02T01:00:00Z", "2026-11-02T02:00:00Z");
    const on = meeting(2, "2026-11-02T02:30:00Z", "2026-11-02T04:00:00Z");
    const next = meeting(3, "2026-11-02T06:00:00Z", "2026-11-02T07:00:00Z");
    expect(currentMeetings([next, over, on], now)).toEqual({ ongoing: [on], upcoming: [next] });
  });

  test("a meeting is over the moment it ends, and under way the moment it starts", () => {
    const ended = meeting(1, "2026-11-02T02:00:00Z", "2026-11-02T03:00:00Z");
    const started = meeting(2, "2026-11-02T03:00:00Z", "2026-11-02T04:00:00Z");
    expect(currentMeetings([ended, started], now)).toEqual({ ongoing: [started], upcoming: [] });
  });

  test("sorts each list by its start, then its id", () => {
    const later = meeting(1, "2026-11-03T02:00:00Z", "2026-11-03T03:00:00Z");
    const sameB = meeting(3, "2026-11-02T06:00:00Z", "2026-11-02T07:00:00Z");
    const sameA = meeting(2, "2026-11-02T06:00:00Z", "2026-11-02T07:00:00Z");
    expect(currentMeetings([later, sameB, sameA], now).upcoming).toEqual([sameA, sameB, later]);
  });
});

test("birthdaysOf keeps the people's birthdays alone", () => {
  const birthday = { kind: "Birthday", date: "2026-11-03", userId: 1, fullName: "An" } as Occasion;
  const holiday = { kind: "Holiday", date: "2026-11-03", endDate: "2026-11-03", holiday: "NewYear" } as unknown as Occasion;
  const company = { kind: "CompanyAnniversary", date: "2026-11-03", years: 5, organizationName: "Cty" } as Occasion;
  expect(birthdaysOf([holiday, company, birthday])).toEqual([birthday]);
});

test("businessDay is the day in UTC+7, whatever the browser's time zone", () => {
  expect(businessDay(Date.parse("2026-11-02T17:00:00Z"))).toBe("2026-11-03");
  expect(businessDay(Date.parse("2026-11-02T16:59:00Z"))).toBe("2026-11-02");
});
