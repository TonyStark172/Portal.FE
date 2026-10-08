import { describe, expect, test } from "vitest";
import { formatDate, trendLabel } from "./format";

describe("dashboard formatting", () => {
  test("shows API dates the Vietnamese way", () => {
    expect(formatDate("2026-10-05")).toBe("05/10/2026");
  });

  test("labels chart steps by day, week or month", () => {
    expect(trendLabel({ from: "2026-10-07", to: "2026-10-07" }, "Month")).toBe("7");
    expect(trendLabel({ from: "2026-10-08", to: "2026-10-14" }, "Quarter")).toBe("08/10");
    expect(trendLabel({ from: "2026-03-01", to: "2026-03-31" }, "Year")).toBe("T3");
  });
});
