import { describe, expect, test } from "vitest";
import { excerptAround, foldText, matchRanges, searchTerms } from "./searchText";

const marked = (text: string, query: string) => matchRanges(text, searchTerms(query)).map(([start, end]) => text.slice(start, end));

describe("the words a search looks for", () => {
  test("are folded like the server's: no accents, lower case, đ as d", () => {
    expect(foldText("Đà Nẵng").folded).toBe("da nang");
    expect(searchTerms("  HỌP   báo cáo  họp ")).toEqual(["hop", "bao", "cao"]);
  });

  test("are at most eight", () => {
    expect(searchTerms("a b c d e f g h i j")).toHaveLength(8);
  });
});

describe("where the words are in a text as written", () => {
  test("whatever their accents and case, in any order", () => {
    expect(marked("Chiều nay HỌP báo cáo quý", "bao hop")).toEqual(["HỌP", "báo"]);
  });

  test("inside longer words too, and every time they occur", () => {
    expect(marked("Mã PRJ-2026-015, xem lại PRJ-2026-016", "2026-01")).toEqual(["2026-01", "2026-01"]);
  });

  test("joined where two of them touch or overlap", () => {
    expect(marked("Mã ABCDEF", "abc cde")).toEqual(["ABCDE"]);
    expect(marked("Mã ABCDEF", "abc def")).toEqual(["ABCDEF"]);
    // A space between them is not part of either.
    expect(marked("báo cáo", "bao cao")).toEqual(["báo", "cáo"]);
  });

  test("with accents written as characters of their own kept with their letter", () => {
    const decomposed = "họp báo";
    expect(marked(decomposed, "hop")).toEqual(["họp"]);
  });

  test("nowhere when nothing matches", () => {
    expect(marked("Không liên quan", "hop")).toEqual([]);
  });
});

describe("the part of a long text shown for a result", () => {
  const long = `${"mở đầu ".repeat(30)}điểm họp chính ${"kết thúc ".repeat(30)}`;

  test("is cut around the first word found", () => {
    const excerpt = excerptAround(long, searchTerms("hop"));
    expect(excerpt.length).toBeLessThanOrEqual(162);
    expect(excerpt).toContain("điểm họp chính");
    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  test("is the whole text when it is short", () => {
    expect(excerptAround("Họp lúc 3 giờ", searchTerms("hop"))).toBe("Họp lúc 3 giờ");
  });
});
