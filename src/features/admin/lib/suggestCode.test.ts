import { expect, test } from "vitest";
import { suggestCode } from "./suggestCode";

test("suggestCode takes the initials without diacritics", () => {
  expect(suggestCode("Phòng Hành chính Nhân sự")).toBe("PHCNS");
  expect(suggestCode("Kế toán")).toBe("KT");
  expect(suggestCode("đ")).toBe("D");
  expect(suggestCode("Đào tạo")).toBe("DT");
});

test("suggestCode ignores punctuation, collapses spaces, caps at 10 and handles empty input", () => {
  expect(suggestCode("  Kinh   doanh (miền Bắc) ")).toBe("KDMB");
  expect(suggestCode("a b c d e f g h i j k l")).toBe("ABCDEFGHIJ");
  expect(suggestCode("Khối 2")).toBe("K2");
  expect(suggestCode("")).toBe("");
  expect(suggestCode("  -- ")).toBe("");
});
