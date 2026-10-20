import type { EventInput } from "@fullcalendar/core";
import { limitPerDay, meetingsOfDay, type CapacityItem, type MoreItems } from "@/features/meetings/calendarCapacity";
import { calendarInputs, calendarTime, capacityOf, showsDots } from "@/features/meetings/calendarInputs";
import { addDateDays, businessUtc } from "@/features/meetings/meetingForm";
import { meetingState } from "@/features/meetings/meetingState";
import type { Meeting } from "@/features/meetings/meetingTypes";
import type { CompanyEvent, Occasion } from "./eventTypes";

type Translate = (key: string) => string;

/** What a company event carries on the calendar (`isAllDay` as a meeting's: the time grid's layout reads it). */
export type CompanyEventProps = { companyEvent: CompanyEvent; isAllDay: boolean };
export type OccasionProps = { occasion: Occasion; isAllDay: true; order: number };
/**
 * What a "+N" entry stands for: meetings (`more`, as before), and the events and occasions a phone's month day left
 * out of its dots; a grid day's "+N" occasions are `moreOccasions` alone, with their `day`.
 */
export type EntryMoreProps = { more?: MoreItems<Meeting>; moreEvents?: CompanyEvent[]; moreOccasions?: Occasion[]; day?: string };
type EntryProps = Partial<CompanyEventProps> & Partial<OccasionProps> & EntryMoreProps;

/** How many entries a "+N" stands for, whatever they are. */
export const entryCount = (props: EntryMoreProps) => (props.more?.items.length ?? 0) + (props.moreEvents?.length ?? 0) + (props.moreOccasions?.length ?? 0);

/** "1st", "2nd", "3rd", "4th", "11th", "21st"…: the English ordinal of `n` (Vietnamese says "{years} năm"). */
export function ordinal(n: number) {
  const tens = n % 100;
  return `${n}${tens >= 11 && tens <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}
/** Fills a message's `{name}` placeholders (those it has). */
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (all, key: string) => key in values ? String(values[key]) : all);

/** "Tết Nguyên đán", "Sinh nhật AnNV · 5 năm" or "Sinh nhật Lê Bình" (in English "AnNV's 5th birthday"…). */
export function occasionTitle(occasion: Occasion, t: Translate) {
  switch (occasion.kind) {
    case "Holiday": return t(`events.holiday.${occasion.holiday}`);
    case "CompanyAnniversary": return fill(t("events.companyBirthdayOf"), { name: occasion.organizationName, years: occasion.years, ordinal: ordinal(occasion.years) });
    default: return fill(t("events.birthdayOf"), { name: occasion.fullName });
  }
}

/** An occasion's look (globals.css `occasion-<tone>`): a public holiday, the company's birthday, a person's birthday. */
export const occasionTone = (occasion: Pick<Occasion, "kind">) =>
  occasion.kind === "Holiday" ? "holiday" : occasion.kind === "CompanyAnniversary" ? "company" : "birthday";
/** In a day: holidays first, then the company's birthday, then people's. */
const occasionRank: Record<Occasion["kind"], number> = { Holiday: 0, CompanyAnniversary: 1, Birthday: 2 };
export const byOccasionRank = (a: Occasion, b: Occasion) => occasionRank[a.kind] - occasionRank[b.kind];

/** The last day an occasion takes (a holiday spans its days, the end included). */
export const occasionLastDay = (occasion: Occasion) => occasion.kind === "Holiday" ? occasion.endDate : occasion.date;
/** Every business day an occasion takes. */
export function occasionDays(occasion: Occasion) {
  const days = [occasion.date];
  for (const last = occasionLastDay(occasion); days.at(-1)! < last;) days.push(addDateDays(days.at(-1)!, 1));
  return days;
}
/** Whether an occasion takes the business `day`. */
export const occasionOn = (occasion: Occasion, day: string) => occasion.date <= day && day <= occasionLastDay(occasion);
/** The instants an occasion takes: its business days. */
const occasionStart = (occasion: Occasion) => businessUtc(occasion.date);
const occasionEnd = (occasion: Occasion) => businessUtc(addDateDays(occasionLastDay(occasion), 1));
export function occasionKey(occasion: Occasion) {
  switch (occasion.kind) {
    case "Holiday": return `occasion:Holiday:${occasion.holiday}:${occasion.date}`;
    case "CompanyAnniversary": return `occasion:CompanyAnniversary:${occasion.date}`;
    default: return `occasion:Birthday:${occasion.userId}:${occasion.date}`;
  }
}
/**
 * Where a holiday stands by the clock at `now`, as a meeting does (other occasions are not drawn by it): under way it
 * takes a deeper tone (`occasion-ongoing`, nothing "live" about it), over it is faded (`meeting-finished`).
 */
export function occasionState(occasion: Occasion, now?: number) {
  return occasion.kind !== "Holiday" || now === undefined ? "upcoming" : meetingState({ startUtc: occasionStart(occasion), endUtc: occasionEnd(occasion) }, now);
}
const stateClasses = { upcoming: [], ongoing: ["occasion-ongoing"], finished: ["meeting-finished"] } as const;

/** Whether a time grid needs its all-day row: for all-day events and for occasions (all-day meetings fill their days). */
export const needsAllDayRow = (events: CompanyEvent[], occasions: Occasion[]) => occasions.length > 0 || events.some(event => event.isAllDay);

/**
 * Company events for FullCalendar: read-only, drawn in their category's colour (globals.css `event-<category>`), all
 * day in the all-day row, each in its state by the clock at `now` as a meeting is (`meeting-ongoing`, `meeting-finished`).
 */
export function companyEventInputs(events: CompanyEvent[], view: string, now?: number): EventInput[] {
  return events.map(event => {
    const state = now === undefined ? "upcoming" : meetingState(event, now);
    return {
      id: `event:${event.id}`, title: event.location ? `${event.title} · ${event.location}` : event.title,
      start: calendarTime(event.startUtc), end: calendarTime(event.endUtc), allDay: event.isAllDay,
      editable: false, startEditable: false, durationEditable: false,
      // A month draws even a short event as a solid bar, not as a dotted line as it does a meeting.
      display: view.startsWith("dayGrid") ? "block" : "auto",
      classNames: ["company-event", `event-${event.category.toLowerCase()}`, ...(state === "upcoming" ? [] : [`meeting-${state}`])],
      extendedProps: { companyEvent: event, isAllDay: event.isAllDay } satisfies CompanyEventProps,
    };
  });
}

/** How many of a day's birthdays (the company's too) a grid shows before gathering them behind "+N" (it then keeps one). */
const occasionsPerDay = 2;

/**
 * One occasion on the calendar: an all-day line, a holiday a bar over its days (or over the one `day` given: a phone's
 * month dot). The calendar orders a day's entries by `order` (a holiday, the company, people, then "+N").
 */
function occasionEntry(occasion: Occasion, title: (occasion: Occasion) => string, now?: number, day?: string): EventInput {
  const holiday = occasion.kind === "Holiday";
  return {
    id: day && holiday ? `${occasionKey(occasion)}:${day}` : occasionKey(occasion), title: title(occasion), allDay: true, editable: false,
    start: day ?? occasion.date, ...(holiday ? { end: addDateDays(day ?? occasionLastDay(occasion), 1) } : {}),
    classNames: ["calendar-occasion", `occasion-${occasionTone(occasion)}`, ...stateClasses[occasionState(occasion, now)]],
    extendedProps: { occasion, isAllDay: true, order: occasionRank[occasion.kind] } satisfies OccasionProps,
  };
}
const moreOrder = 3;

/**
 * Occasions for FullCalendar: a holiday is a bar over its days; the others are an all-day line each, and a grid's day
 * crowded with them keeps one and a "+N" opening the day (unless `grouped` is false: a list shows them all).
 */
export function occasionInputs(occasions: Occasion[], view: string, title: (occasion: Occasion) => string, moreLabel: (count: number) => string, grouped = true, now?: number): EventInput[] {
  const entry = (occasion: Occasion) => occasionEntry(occasion, title, now);
  if (!grouped || view.startsWith("list")) return occasions.map(entry);
  const days = new Map<string, Occasion[]>();
  for (const occasion of occasions) if (occasion.kind !== "Holiday") days.set(occasion.date, [...(days.get(occasion.date) ?? []), occasion]);
  return [
    ...occasions.filter(occasion => occasion.kind === "Holiday").map(entry),
    ...[...days].flatMap(([day, items]) => items.length <= occasionsPerDay ? items.map(entry) : [
      entry(items[0]),
      {
        id: `occasions:${day}`, title: moreLabel(items.length - 1), start: day, allDay: true, editable: false, classNames: ["meeting-more", "occasion-more"],
        extendedProps: { moreOccasions: items.slice(1), day, isAllDay: true, order: moreOrder },
      },
    ]),
  ];
}

/** A phone's month dot: a meeting, an event, or an occasion on one of its days (`day`: a holiday has a dot on each). */
type DotItem = CapacityItem & { meeting?: Meeting; event?: CompanyEvent; occasion?: Occasion; day?: string };

export type CalendarEntryOptions = {
  view: string;
  isMobile: boolean;
  userId: number | undefined;
  /** The clock (an instant, ms): which meetings and events are on or over. */
  now?: number;
  /** "+N" of meetings; of occasions in a grid's day, and of anything in a phone's month day (each the same by default). */
  moreLabel: (count: number) => string;
  moreOccasionsLabel?: (count: number) => string;
  moreEntriesLabel?: (count: number) => string;
  occasionTitle: (occasion: Occasion) => string;
};

/**
 * Everything the calendar draws: meetings (calendarInputs.ts), company events and occasions. A phone's month day
 * keeps three dots in all, whatever they are, and counts the others in one "+N" (a tap opens the whole day).
 */
export function calendarEntries(meetings: Meeting[], events: CompanyEvent[], occasions: Occasion[], options: CalendarEntryOptions): EventInput[] {
  const { view, isMobile, userId, now, moreLabel, occasionTitle: title } = options;
  const moreOccasions = options.moreOccasionsLabel ?? moreLabel;
  if (!showsDots(view, isMobile)) return [
    ...calendarInputs(meetings, view, isMobile, userId, moreLabel, now),
    ...companyEventInputs(events, view, now),
    ...occasionInputs(occasions, view, title, moreOccasions, true, now),
  ];
  let id = 0;
  const items: DotItem[] = [
    ...meetings.map(meeting => ({ id: ++id, startUtc: meeting.startUtc, endUtc: meeting.endUtc, meeting })),
    ...events.map(event => ({ id: ++id, startUtc: event.startUtc, endUtc: event.endUtc, event })),
    ...[...occasions].sort(byOccasionRank).flatMap((occasion): DotItem[] => occasion.kind === "Holiday"
      ? occasionDays(occasion).map(day => ({ id: ++id, startUtc: businessUtc(day), endUtc: businessUtc(addDateDays(day, 1)), occasion, day }))
      : [{ id: ++id, startUtc: occasionStart(occasion), endUtc: occasionEnd(occasion), occasion }]),
  ];
  const { limit, keep } = capacityOf(view, isMobile);
  const { shown, more } = limitPerDay(items, limit, keep);
  const pick = <K extends "meeting" | "event" | "occasion">(list: DotItem[], key: K) => list.flatMap(item => item[key] ? [item[key]!] : []) as NonNullable<DotItem[K]>[];
  return [
    ...calendarInputs(pick(shown, "meeting"), view, isMobile, userId, moreLabel, now),
    ...companyEventInputs(pick(shown, "event"), view, now),
    ...shown.flatMap(item => item.occasion ? [occasionEntry(item.occasion, title, now, item.day)] : []),
    ...more.map((group): EventInput => {
      const props: EntryMoreProps = {
        more: { ...group, items: pick(group.items, "meeting") }, moreEvents: pick(group.items, "event"), moreOccasions: pick(group.items, "occasion"),
      };
      return {
        id: group.key, title: (options.moreEntriesLabel ?? moreLabel)(group.items.length), start: calendarTime(group.startUtc),
        end: calendarTime(new Date(Date.parse(group.startUtc) + 30 * 60000).toISOString()), allDay: false, editable: false,
        classNames: ["meeting-more"], extendedProps: props,
      };
    }),
  ];
}

/** A business day's meetings, events and occasions, as a day's list shows them. */
export type DayGroup = MoreItems<Meeting> & { events: CompanyEvent[]; occasions: Occasion[] };

/**
 * Everything the calendar holds on the business `day`, from what its entries carry (those behind "+N" too); null when
 * it holds nothing.
 */
export function dayGroupOf(entries: EntryProps[], day: string): DayGroup | null {
  const meetings: Meeting[] = [];
  const events: CompanyEvent[] = [];
  const occasions: Occasion[] = [];
  for (const props of entries) {
    if (props.companyEvent) events.push(props.companyEvent);
    else if (props.occasion) occasions.push(props.occasion);
    else if (props.more || props.moreEvents || props.moreOccasions) {
      meetings.push(...props.more?.items ?? []);
      events.push(...props.moreEvents ?? []);
      occasions.push(...props.moreOccasions ?? []);
    } else meetings.push(props as unknown as Meeting);
  }
  const ofDay = meetingsOfDay(meetings, day);
  const dayEvents = meetingsOfDay(events, day)?.items ?? [];
  const dayOccasions = [...new Map(occasions.filter(occasion => occasionOn(occasion, day)).map(occasion => [occasionKey(occasion), occasion])).values()].sort(byOccasionRank);
  if (!ofDay && !dayEvents.length && !dayOccasions.length) return null;
  const start = businessUtc(day);
  return {
    key: `day:${day}`, day, startUtc: ofDay?.startUtc ?? start, endUtc: ofDay?.endUtc ?? businessUtc(addDateDays(day, 1)),
    items: ofDay?.items ?? [], events: dayEvents, occasions: dayOccasions,
  };
}
