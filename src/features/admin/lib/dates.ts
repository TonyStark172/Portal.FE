const pad = (value: number) => String(value).padStart(2, "0");

/** When an invitation runs out, short and in the user's own time zone: "14:30 ngày 21/10" ("Oct 21, 2:30 PM"). */
export function formatExpiry(iso: string, locale: string): string {
  const date = new Date(iso);
  if (locale === "en-US") return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ngày ${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

/**
 * A day as an `<input type="date">` takes and the API reads it ("2026-10-15"), in the user's own time zone. Not
 * `toISOString().slice(0, 10)`: that is the UTC day, which for someone in Vietnam is still yesterday until 07:00.
 */
export const todayAsDateInput = (now: Date = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/**
 * A calendar day the API sends as `DateOnly` ("2026-10-15") for people: "15/10/2026" ("Oct 15, 2026"). It is read as
 * the day it names, not as a moment, so no time zone moves it; anything that is not such a day comes back as given.
 */
export function formatDay(day: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const [, year, month, date] = match;
  if (locale === "en-US") return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(Number(year), Number(month) - 1, Number(date)));
  return `${date}/${month}/${year}`;
}
