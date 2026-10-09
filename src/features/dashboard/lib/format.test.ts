import { describe, expect, test } from "vitest";
import { formatDate, trendLabel } from "./format";

describe("dashboard formatting", () => {
  test("shows API dates the Vietnamese way", () => {
    expect(formatDate("2026-10-05")).toBe("05/10/2026");
  });

  test("labels chart steps by the week's last day for a month (the headcount is at its end), by month otherwise", () => {
    expect(trendLabel({ from: "2026-10-08", to: "2026-10-14" }, "Month")).toBe("14/10");
    expect(trendLabel({ from: "2026-10-01", to: "2026-10-31" }, "Quarter")).toBe("T10");
    expect(trendLabel({ from: "2026-03-01", to: "2026-03-31" }, "Year")).toBe("T3");
  });
});
