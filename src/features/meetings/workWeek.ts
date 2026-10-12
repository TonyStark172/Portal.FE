import { weekdays } from "./meetingForm";
import type { Weekday } from "./meetingTypes";

type Translate = (key: string) => string;

/** One day of the organization's work week, as the API stores it: working when it has both times ("HH:mm"). */
export type WorkDay = { day: Weekday; start: string | null; end: string | null };
/**
 * The work-week editor: the working days (Monday-first), the range most of them share, and the days whose own hours
 * differ from it. A day off keeps no hours.
 */
export type WorkWeekForm = { days: Weekday[]; start: string; end: string; overrides: Partial<Record<Weekday, { start: string; end: string }>> };

/** The API's order, Sunday..Saturday: a day's index is its FullCalendar number (0 = Sunday). */
const apiDays: Weekday[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayKeys: Record<Weekday, string> = {
  Monday: "meetings.dayMon", Tuesday: "meetings.dayTue", Wednesday: "meetings.dayWed", Thursday: "meetings.dayThu",
  Friday: "meetings.dayFri", Saturday: "meetings.daySat", Sunday: "meetings.daySun",
};
const fallback = { start: "08:00", end: "17:00" };

type Working = { day: Weekday; start: string; end: string };
const isWorking = (day: WorkDay): day is Working => day.start !== null && day.end !== null;
/** The working days, Monday-first. */
const workingDays = (week: WorkDay[]) => weekdays.flatMap(name => week.filter(d => d.day === name && isWorking(d)) as Working[]);
const rangeOf = (day: { start: string; end: string }) => `${day.start}–${day.end}`;

/** Days with the same hours together, in the order their first day comes (Monday-first). */
function byRange(days: Working[]) {
  const groups = new Map<string, Working[]>();
  for (const day of days) groups.set(rangeOf(day), [...groups.get(rangeOf(day)) ?? [], day]);
  return [...groups.values()];
}

export function toWorkWeekForm(week: WorkDay[]): WorkWeekForm {
  const working = workingDays(week);
  // The range most days share; on a tie, the one of the earliest day.
  const common = byRange(working).reduce<Working[]>((most, group) => group.length > most.length ? group : most, [])[0] ?? fallback;
  const overrides: WorkWeekForm["overrides"] = {};
  for (const day of working) if (rangeOf(day) !== rangeOf(common)) overrides[day.day] = { start: day.start, end: day.end };
  return { days: working.map(d => d.day), start: common.start, end: common.end, overrides };
}

export function fromWorkWeekForm(form: WorkWeekForm): WorkDay[] {
  return apiDays.map(day => {
    if (!form.days.includes(day)) return { day, start: null, end: null };
    const hours = form.overrides[day] ?? form;
    return { day, start: hours.start, end: hours.end };
  });
}

/** Days as short labels: a run of three or more as "T2–T6", others listed ("T7, CN"). */
function daysLabel(days: Weekday[], t: Translate) {
  const runs: Weekday[][] = [];
  for (const day of days) {
    const run = runs.at(-1);
    if (run && weekdays.indexOf(day) === weekdays.indexOf(run.at(-1)!) + 1) run.push(day);
    else runs.push([day]);
  }
  return runs.map(run => run.length >= 3 ? `${t(dayKeys[run[0]])}–${t(dayKeys[run.at(-1)!])}` : run.map(d => t(dayKeys[d])).join(", ")).join(", ");
}

/** "T2–T6 08:00–17:00 · T7 08:00–12:00 · Nghỉ CN" */
export function summarizeWorkWeek(week: WorkDay[], t: Translate): string {
  const working = workingDays(week);
  const parts = byRange(working).map(group => `${daysLabel(group.map(d => d.day), t)} ${rangeOf(group[0])}`);
  const off = weekdays.filter(day => !working.some(d => d.day === day));
  if (off.length) parts.push(t("settings.meetings.daysOff").replace("{days}", daysLabel(off, t)));
  return parts.join(" · ");
}

export function validateWorkWeekForm(form: WorkWeekForm, t: Translate): string | null {
  if (!form.days.length) return t("settings.meetings.errorNoDay");
  if (form.end <= form.start) return t("settings.meetings.errorRange");
  for (const day of form.days) {
    const hours = form.overrides[day];
    if (hours && hours.end <= hours.start) return `${t(dayKeys[day])}: ${t("settings.meetings.errorRange")}`;
  }
  return null;
}

/** FullCalendar's business hours: one entry per range, with the days (0 = Sunday) that keep it. */
export function businessHoursOf(week: WorkDay[]): { daysOfWeek: number[]; startTime: string; endTime: string }[] {
  const working = apiDays.flatMap(name => week.filter(d => d.day === name && isWorking(d)) as Working[]);
  return byRange(working).map(group => ({ daysOfWeek: group.map(d => apiDays.indexOf(d.day)), startTime: group[0].start, endTime: group[0].end }));
}

/** Where the time grid opens: the earliest start of the week ("08:00:00"). */
export function scrollTimeOf(week: WorkDay[]): string {
  const starts = workingDays(week).map(d => d.start).sort();
  return `${starts[0] ?? fallback.start}:00`;
}
