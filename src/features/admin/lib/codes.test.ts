import { expect, test } from "vitest";
import { suggestCode } from "./codes";

test("a code from the initials of a name, without diacritics, in capitals", () => {
  expect(suggestCode("Phòng Kỹ thuật")).toBe("PKT");
  expect(suggestCode("Đảng ủy")).toBe("DU");
  expect(suggestCode("Ban biên tập")).toBe("BBT");
});

test("numbers are kept whole, punctuation is dropped", () => {
  expect(suggestCode("Tổ 12")).toBe("T12");
  expect(suggestCode("Phòng Hành chính - Tổng hợp")).toBe("PHCTH");
});

test("nothing to suggest from an empty name", () => {
  expect(suggestCode("")).toBe("");
  expect(suggestCode("  -  ")).toBe("");
});
