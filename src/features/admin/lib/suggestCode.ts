/** Longest code suggested. */
const MAX_SUGGESTED_CODE_LENGTH = 10;

/**
 * Suggests a code (of a department, a position…) from its name: the first letter or digit of each word, without Vietnamese diacritics,
 * upper-cased, at most 10 characters ("Phòng Hành chính Nhân sự" gives "PHCNS"). Punctuation separates words and is
 * otherwise ignored; an empty name gives an empty code.
 */
export function suggestCode(name: string): string {
  const plain = name
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return plain
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 0)
    .map((word) => word[0].toUpperCase())
    .join("")
    .slice(0, MAX_SUGGESTED_CODE_LENGTH);
}
