import type { ChatPollDto } from "@/shared/api/generated/portalApi";

type Translate = (key: string) => string;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The same limits as Portal.BE's ConversationRules.MinPollDuration and MaxPollDuration. */
export const MIN_POLL_DURATION_MS = 5 * MINUTE;
export const MAX_POLL_DURATION_MS = 30 * DAY;

/** The deadlines offered when asking a poll, as durations from then ("Other" picks a date and time). */
export const POLL_DURATIONS = [
  { id: "1h", ms: HOUR, label: "messages.poll.duration.1h" },
  { id: "3h", ms: 3 * HOUR, label: "messages.poll.duration.3h" },
  { id: "8h", ms: 8 * HOUR, label: "messages.poll.duration.8h" },
  { id: "1d", ms: DAY, label: "messages.poll.duration.1d" },
  { id: "3d", ms: 3 * DAY, label: "messages.poll.duration.3d" },
] as const;

/** Whether a poll is over at `now` (ms): someone ended it, or its deadline passed. */
export function pollIsOver(poll: Pick<ChatPollDto, "closedAt" | "endsAt">, now: number): boolean {
  return poll.closedAt !== null || (poll.endsAt !== null && Date.parse(poll.endsAt) <= now);
}

/** Whether a poll that is still open ends within the hour: its countdown is then drawn as urgent. */
export function pollEndsSoon(endsAt: string, now: number): boolean {
  const left = Date.parse(endsAt) - now;
  return left > 0 && left <= HOUR;
}

/**
 * How long a poll still runs: "Còn 2 ngày 3 giờ", "Còn 4 giờ 15 phút", "Còn 5 phút", "Sắp kết thúc" in its last minute;
 * empty once it is over. Counted in whole minutes rounded up, so 59 min 59 s reads "Còn 1 giờ", never "Còn 60 phút".
 */
export function pollRemaining(endsAt: string, now: number, t: Translate): string {
  const left = Date.parse(endsAt) - now;
  if (left <= 0) return "";
  if (left < MINUTE) return t("messages.poll.endsSoon");
  const total = Math.ceil(left / MINUTE);
  const perDay = DAY / MINUTE;
  const perHour = HOUR / MINUTE;
  if (total >= perDay) {
    const days = Math.floor(total / perDay);
    const hours = Math.floor((total % perDay) / perHour);
    return (hours ? t("messages.poll.leftDaysHours").replace("{h}", String(hours)) : t("messages.poll.leftDays")).replace("{d}", String(days));
  }
  if (total >= perHour) {
    const hours = Math.floor(total / perHour);
    const minutes = total % perHour;
    return (minutes ? t("messages.poll.leftHoursMinutes").replace("{m}", String(minutes)) : t("messages.poll.leftHours")).replace("{h}", String(hours));
  }
  return t("messages.poll.leftMinutes").replace("{m}", String(total));
}

/** The exact time a deadline falls on, as "15:30 25/11/2026". */
export function pollDeadline(endsAt: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(endsAt));
}

/** A local date and time as the date field reads it ("2026-11-25T15:30:00"), to the minute. */
export function toLocalDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}
