const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** The day of a message on the reader's clock, as a key ("2026-11-23") to tell when the day changes. */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** "14:05". */
export function clockTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** In the list: the time for today's last message, the date for an older one ("20/11", or "20/11/2025" last year). */
export function listTime(iso: string, locale: string, now = new Date()): string {
  const date = new Date(iso);
  if (sameDay(date, now)) return clockTime(iso, locale);
  const parts = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(date);
  if (date.getFullYear() !== now.getFullYear()) return parts.map((part) => part.value).join("");
  // Without the year, cut from the full date: asked for day and month alone, some locales change the separator
  // (Vietnamese gives "20-11" instead of "20/11").
  const year = parts.findIndex((part) => part.type === "year");
  const literal = parts[year - 1]?.type === "literal" ? year - 1 : year + 1;
  return parts.filter((_, index) => index !== year && index !== literal).map((part) => part.value).join("");
}

/** Between the messages of two days: "today", "yesterday", or the date with its weekday. */
export function dayLabel(iso: string, locale: string, labels: { today: string; yesterday: string }, now = new Date()): string {
  const date = new Date(iso);
  if (sameDay(date, now)) return labels.today;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return labels.yesterday;
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

/** Two messages close enough in time, from the same person, are drawn as one group (one avatar, tighter spacing). */
export const GROUP_WINDOW_MS = 5 * 60_000;
