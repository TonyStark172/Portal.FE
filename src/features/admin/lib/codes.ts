import { foldVietnamese } from "@/shared/lib/vietnameseSearch";

/** The longest code the API takes. */
const CODE_MAX_LENGTH = 50;

/**
 * A code suggested from a name, for a department or a position: the initials of its words without diacritics, in
 * capitals, numbers kept whole ("Phòng Kỹ thuật" → "PKT", "Tổ 12" → "T12"). The user may change it; the API checks it
 * is unique.
 */
export function suggestCode(name: string): string {
  return foldVietnamese(name)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => (/^\d+$/.test(word) ? word : word[0]))
    .join("")
    .toUpperCase()
    .slice(0, CODE_MAX_LENGTH);
}
