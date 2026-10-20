import { describe, expect, test } from "vitest";
import { formatSeniority } from "./seniority";

describe("seniority", () => {
  test("shows years and months, or days when shorter than a month", () => {
    expect(formatSeniority(15)).toBe("15 ngày");
    expect(formatSeniority(45)).toBe("1 tháng");
    expect(formatSeniority(365)).toBe("1 năm");
    expect(formatSeniority(400)).toBe("1 năm 1 tháng");
    expect(formatSeniority(2 * 365 + 70)).toBe("2 năm 2 tháng");
  });

  test("shows a dash when unknown", () => {
    expect(formatSeniority(null)).toBe("—");
    expect(formatSeniority(undefined)).toBe("—");
  });
});
