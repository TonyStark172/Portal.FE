import { expect, test } from "vitest";
import { formatBusinessTime } from "./businessTime";

test("a time is shown in business time, to the minute", () => {
  const shown = formatBusinessTime("2026-10-12T01:15:00Z", "vi-VN");

  expect(shown).toContain("08:15");
  expect(shown).toContain("12/10/2026");
  expect(shown).not.toContain("08:15:00");
});

test("the caller can ask for the time only", () => {
  expect(formatBusinessTime("2026-10-12T01:15:00Z", "vi-VN", { hour: "2-digit", minute: "2-digit" })).toBe("08:15");
});
