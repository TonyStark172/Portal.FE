import { describe, expect, test } from "vitest";
import { formatPercent, toGenderSlices } from "./genderSlices";

describe("gender slices", () => {
  test("lists men then women, each as a share of those who gave their gender", () => {
    const slices = toGenderSlices({ male: 3, female: 1, unspecified: 4, total: 8 });

    expect(slices.map((s) => [s.key, s.label, s.count, s.percent])).toEqual([
      ["male", "Nam", 3, 75],
      ["female", "Nữ", 1, 25],
    ]);
  });

  test("gives both 0% when nobody gave their gender", () => {
    const slices = toGenderSlices({ male: 0, female: 0, unspecified: 5, total: 5 });

    expect(slices.every((s) => s.percent === 0)).toBe(true);
  });

  test("formats shares the Vietnamese way, with at most one decimal", () => {
    expect(formatPercent(37.5)).toBe("37,5%");
    expect(formatPercent(100 / 3)).toBe("33,3%");
    expect(formatPercent(50)).toBe("50%");
  });
});
