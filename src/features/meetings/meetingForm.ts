import { BUSINESS_OFFSET, BUSINESS_OFFSET_MS } from "./businessTime";
import type { AudienceSelection, EditScope, Meeting, MeetingFormValue, MeetingWriteRequest, RecurrenceRule, Weekday } from "./meetingTypes";

type Translate = (key: string) => string;

export const weekdays: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The business-time input ("yyyy-mm-ddThh:mm") of an instant. */
export function businessInput(instant: string | Date) { return new Date(new Date(instant).getTime() + BUSINESS_OFFSET_MS).toISOString().slice(0, 16); }
/** The business day (UTC+7) of an instant, "yyyy-mm-dd". */
export function businessDate(instant: string | Date) { return businessInput(instant).slice(0, 10); }
/** The instant (UTC, ISO) of a business-time input; a date alone is its midnight. */
export function businessUtc(local: string) { return new Date(`${local.length === 10 ? `${local}T00:00` : local}${BUSINESS_OFFSET}`).toISOString(); }
export function addDateDays(date: string, days: number) {
  const value = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
const daysBetween = (from: string, to: string) => (Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86400000;
export function weekdayOf(date: string): Weekday { return weekdays[(new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay() + 6) % 7]; }

export function newMeetingForm(kind: string, now = new Date()): MeetingFormValue {
  const start = new Date(Math.ceil(now.getTime() / 900000) * 900000);
  return {
    title: "", kind, location: "", start: businessInput(start), end: businessInput(new Date(start.getTime() + 3600000)), isAllDay: false,
    recurrence: null, audience: { userIds: [], departmentIds: [], allEmployees: false, excludedUserIds: [] }, scope: "Occurrence", replaceExceptions: false,
  };
}

/** The form for editing `meeting`, whose people were picked as `audience`. */
export function fromMeeting(meeting: Meeting, audience: AudienceSelection): MeetingFormValue {
  return {
    title: meeting.title, kind: meeting.kind, location: meeting.location,
    start: meeting.isAllDay ? businessDate(meeting.startUtc) : businessInput(meeting.startUtc),
    end: meeting.isAllDay ? addDateDays(businessInput(meeting.endUtc), -1) : businessInput(meeting.endUtc),
    isAllDay: meeting.isAllDay, recurrence: meeting.seriesSchedule?.recurrence ?? null,
    audience, savedAudience: audience, scope: "Occurrence", replaceExceptions: false, editing: meeting,
  };
}

/** What an edit applies to: a series' chosen scope; a meeting on its own given a recurrence becomes a whole series. */
export function editScopeOf(value: MeetingFormValue): EditScope {
  if (value.editing?.seriesId) return value.scope;
  return value.recurrence ? "Series" : "Occurrence";
}

// Used only to recover a form's original anchor/estimate, never to generate calendar events.
export function recurrenceDates(startDate: string, rule: RecurrenceRule): string[] {
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00Z`);
  const result: string[] = [];
  if (!Number.isFinite(start.getTime()) || !Number.isInteger(rule.interval) || rule.interval < 1) return result;
  const max = rule.count ?? 367;
  for (let step = 0; step < 10000 && result.length < max; step++) {
    const date = new Date(start);
    if (rule.frequency === "Monthly") {
      date.setUTCDate(1); date.setUTCMonth(start.getUTCMonth() + step * rule.interval);
      const month = date.getUTCMonth(); date.setUTCDate(start.getUTCDate());
      if (date.getUTCMonth() !== month) continue;
    } else if (rule.frequency === "Yearly") {
      date.setUTCFullYear(start.getUTCFullYear() + step * rule.interval);
      if (date.getUTCMonth() !== start.getUTCMonth()) continue;
    } else {
      const offset = rule.frequency === "Daily" ? step * rule.interval : Math.floor(step / 7) * rule.interval * 7 + step % 7 - (start.getUTCDay() + 6) % 7;
      if (offset < 0) continue;
      date.setUTCDate(start.getUTCDate() + offset);
    }
    if (date.getUTCFullYear() > 9999) break;
    const day = date.toISOString().slice(0, 10);
    if (rule.until && day > rule.until) break;
    const match = rule.frequency !== "Weekly" || (rule.weekdays.length ? rule.weekdays : [weekdayOf(startDate)]).includes(weekdayOf(day));
    if (match) result.push(day);
  }
  return result;
}

/**
 * The rule after the start moved from `previous` to `next`: a weekly rule on the start's own weekday follows it, and
 * an end date the start went past moves with it (same length); weekdays picked by hand stay.
 */
export function reanchorRecurrence(rule: RecurrenceRule | null, previous: string, next: string): RecurrenceRule | null {
  if (!rule || !previous || !next || previous.slice(0, 10) === next.slice(0, 10)) return rule;
  let result = rule;
  if (rule.frequency === "Weekly" && rule.weekdays.length === 1 && rule.weekdays[0] === weekdayOf(previous))
    result = { ...result, weekdays: [weekdayOf(next)] };
  if (rule.until && rule.until < next.slice(0, 10))
    result = { ...result, until: addDateDays(next, Math.max(0, daysBetween(previous, rule.until))) };
  return result;
}

function scopeAnchor(meeting: Meeting, scope: EditScope): Meeting {
  const schedule = meeting.seriesSchedule;
  if (scope === "Occurrence" || !schedule?.recurrence || meeting.occurrenceKey == null) return meeting;
  const day = recurrenceDates(businessInput(schedule.startUtc), schedule.recurrence)[meeting.occurrenceKey];
  if (!day) return meeting;
  const startUtc = businessUtc(`${day}T${businessInput(schedule.startUtc).slice(11)}`);
  // Preserve seconds and milliseconds from the original rule.
  const start = new Date(startUtc).getTime() + new Date(schedule.startUtc).getUTCSeconds() * 1000 + new Date(schedule.startUtc).getUTCMilliseconds();
  return { ...meeting, startUtc: new Date(start).toISOString(), endUtc: new Date(start + Date.parse(schedule.endUtc) - Date.parse(schedule.startUtc)).toISOString(), isAllDay: schedule.isAllDay };
}

export function changeEditScope(value: MeetingFormValue, scope: EditScope): MeetingFormValue {
  if (!value.editing) return { ...value, scope };
  const audience = value.savedAudience ?? value.audience;
  const current = fromMeeting(scopeAnchor(value.editing, value.scope), audience);
  const next = fromMeeting(scopeAnchor(value.editing, scope), audience);
  const untouched = value.start === current.start && value.end === current.end && value.isAllDay === current.isAllDay;
  return { ...value, scope, replaceExceptions: false, ...(untouched ? { start: next.start, end: next.end, isAllDay: next.isAllDay } : {}) };
}

const sameIds = (a: number[], b: number[]) => [...new Set(a)].sort().join(",") === [...new Set(b)].sort().join(",");
export const sameAudience = (a: AudienceSelection, b: AudienceSelection) =>
  a.allEmployees === b.allEmployees && sameIds(a.userIds, b.userIds) && sameIds(a.departmentIds, b.departmentIds) && sameIds(a.excludedUserIds, b.excludedUserIds);

export function toMeetingWriteRequest(value: MeetingFormValue, mutationId: string): MeetingWriteRequest {
  const scope = editScopeOf(value);
  const reference = value.editing ? scopeAnchor(value.editing, scope) : null;
  const original = reference ? fromMeeting(reference, value.audience) : null;
  const preserve = !!original && value.isAllDay === original.isAllDay;
  const startUtc = preserve && value.start === original!.start ? reference!.startUtc : businessUtc(value.start);
  const endUtc = preserve && value.end === original!.end ? reference!.endUtc : businessUtc(value.isAllDay ? addDateDays(value.end, 1) : value.end);
  // The same people as saved: keep them as they are (reminders already sent stay sent).
  const keepPeople = !!value.savedAudience && sameAudience(value.audience, value.savedAudience);
  return {
    title: value.title.trim(), kind: value.kind.trim(), location: value.location.trim(),
    schedule: { startUtc, endUtc, isAllDay: value.isAllDay, recurrence: value.editing && scope === "Occurrence" ? null : value.recurrence },
    audience: keepPeople ? null : value.audience, participantIds: null, mutationId,
  };
}

const unitKeys = { Daily: "meetings.unitDays", Weekly: "meetings.unitWeeks", Monthly: "meetings.unitMonths", Yearly: "meetings.unitYears" } as const;
const dayKeys = ["meetings.dayMon", "meetings.dayTue", "meetings.dayWed", "meetings.dayThu", "meetings.dayFri", "meetings.daySat", "meetings.daySun"];

export function recurrenceSummary(rule: RecurrenceRule | null, t: Translate): string {
  if (!rule) return t("meetings.noRepeat");
  const every = t("meetings.summaryEvery").replace("{interval}", String(rule.interval)).replace("{unit}", t(unitKeys[rule.frequency]));
  const days = rule.frequency === "Weekly" && rule.weekdays.length ? ` · ${rule.weekdays.map(d => t(dayKeys[weekdays.indexOf(d)])).join(", ")}` : "";
  const end = rule.count !== null ? t("meetings.summaryCount").replace("{count}", String(rule.count))
    : rule.until ? t("meetings.summaryUntil").replace("{date}", rule.until) : t("meetings.summaryNoUntil");
  const skips = rule.frequency === "Monthly" || rule.frequency === "Yearly" ? ` ${t("meetings.summarySkips")}` : "";
  return `${every}${days} · ${end}${skips}`;
}

export function validateMeetingForm(value: MeetingFormValue, t: Translate): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, limit] of [["title", 200], ["kind", 100], ["location", 200]] as const)
    if (!value[field].trim() || value[field].trim().length > limit) errors[field] = t("meetings.errorRequired").replace("{max}", String(limit));
  try {
    const start = new Date(businessUtc(value.start)).getTime();
    const end = new Date(businessUtc(value.isAllDay ? addDateDays(value.end, 1) : value.end)).getTime();
    if (end - start < 900000) errors.end = t("meetings.errorDuration");
  } catch { errors.start = t("meetings.errorDates"); }
  const rule = value.editing && editScopeOf(value) === "Occurrence" ? null : value.recurrence;
  if (rule) {
    if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 366 || (rule.count === null) === (rule.until === null) ||
      rule.count !== null && (!Number.isInteger(rule.count) || rule.count < 1 || rule.count > 366)) errors.recurrence = t("meetings.errorRecurrence");
    if (rule.until && (!Number.isFinite(Date.parse(rule.until)) || rule.until < value.start.slice(0, 10) || daysBetween(value.start, rule.until) > 3653))
      errors.recurrence = t("meetings.errorUntil");
    if (rule.frequency === "Weekly" && rule.weekdays.length && !rule.weekdays.includes(weekdayOf(value.start))) errors.recurrence = t("meetings.errorWeekday");
  }
  return errors;
}
