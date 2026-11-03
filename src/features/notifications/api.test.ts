import { expect, test } from "vitest";
import { formatUnread } from "./api";

test("nothing at 0, the number from 1 to 9, and a dot without a number above", () => {
  expect(formatUnread(0)).toBeNull();
  expect(formatUnread(1)).toBe("1");
  expect(formatUnread(9)).toBe("9");
  expect(formatUnread(10)).toBe("");
  expect(formatUnread(12_345)).toBe("");
});
