/**
 * Seniority from Portal.BE (days worked over every stay, gaps left out) → "2 năm 2 tháng". A year is counted as
 * 365 days and a month as 30, close enough for a summary; under a month, the days themselves.
 */
export function formatSeniority(days: number | null | undefined) {
  if (days === null || days === undefined) return "—";

  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years === 0 && months === 0) return `${days} ngày`;

  return [years > 0 && `${years} năm`, months > 0 && `${months} tháng`].filter(Boolean).join(" ");
}
