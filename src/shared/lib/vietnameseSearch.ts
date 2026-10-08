/** Lower case without diacritics: "Hà Nội" → "ha noi", "Đà Nẵng" → "da nang". */
export function foldVietnamese(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}

/**
 * Whether `text` matches what the user typed, ignoring case and diacritics ("ha noi" finds "Hà Nội"),
 * or by the initials of its words ("hcm" finds "Hồ Chí Minh").
 */
export function matchesVietnamese(text: string, query: string): boolean {
  const typed = foldVietnamese(query);
  if (!typed) return true;

  const folded = foldVietnamese(text);
  const initials = folded
    .split(/\s+/)
    .map((word) => word[0])
    .join("");

  return folded.includes(typed) || initials.startsWith(typed.replace(/\s+/g, ""));
}
