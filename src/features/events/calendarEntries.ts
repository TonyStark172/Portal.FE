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

/** "Sinh nhật Lê Bình", or "3 năm · Lê Bình" for a work anniversary. */
export function occasionTitle(occasion: Occasion, t: Translate) {
  return occasion.kind === "Birthday"
    ? t("events.birthdayOf").replace("{name}", occasion.fullName)
    : t("events.anniversaryShort").replace("{years}", String(occasion.years ?? 0)).replace("{name}", occasion.fullName);
}

/** The instants an occasion takes: its business day. */
const occasionStart = (occasion: Occasion) => businessUtc(occasion.date);
const occasionEnd = (occasion: Occasion) => businessUtc(addDateDays(occasion.date, 1));
export const occasionKey = (occasion: Occasion) => `occasion:${occasion.kind}:${occasion.userId}:${occasion.date}`;

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

/** How many occasions a grid's day shows before gathering them behind "+N" (it then keeps one). */
const occasionsPerDay = 2;

/**
 * Occasions for FullCalendar: an all-day line each; a grid's crowded day keeps one and a "+N" opening the day (unless
 * `grouped` is false: a phone's month dots, already counted).
 */
export function occasionInputs(occasions: Occasion[], view: string, title: (occasion: Occasion) => string, moreLabel: (count: number) => string, grouped = true): EventInput[] {
  const entry = (occasion: Occasion): EventInput => ({
    id: occasionKey(occasion), title: title(occasion), start: occasion.date, allDay: true, editable: false,
    classNames: ["calendar-occasion", `occasion-${occasion.kind === "Birthday" ? "birthday" : "anniversary"}`],
    // A day's occasions come before its "+N" (the calendar orders entries of the same day by `order`).
    extendedProps: { occasion, isAllDay: true, order: 0 } satisfies OccasionProps,
  });
  if (!grouped || view.startsWith("list")) return occasions.map(entry);
  const days = new Map<string, Occasion[]>();
  for (const occasion of occasions) days.set(occasion.date, [...(days.get(occasion.date) ?? []), occasion]);
  return [...days].flatMap(([day, items]) => items.length <= occasionsPerDay ? items.map(entry) : [
    entry(items[0]),
    {
      id: `occasions:${day}`, title: moreLabel(items.length - 1), start: day, allDay: true, editable: false, classNames: ["meeting-more", "occasion-more"],
      extendedProps: { moreOccasions: items.slice(1), day, isAllDay: true, order: 1 },
    },
  ]);
}

type DotItem = CapacityItem & { meeting?: Meeting; event?: CompanyEvent; occasion?: Occasion };

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
    ...occasionInputs(occasions, view, title, moreOccasions),
  ];
  let id = 0;
  const items: DotItem[] = [
    ...meetings.map(meeting => ({ id: ++id, startUtc: meeting.startUtc, endUtc: meeting.endUtc, meeting })),
    ...events.map(event => ({ id: ++id, startUtc: event.startUtc, endUtc: event.endUtc, event })),
    ...occasions.map(occasion => ({ id: ++id, startUtc: occasionStart(occasion), endUtc: occasionEnd(occasion), occasion })),
  ];
  const { limit, keep } = capacityOf(view, isMobile);
  const { shown, more } = limitPerDay(items, limit, keep);
  const pick = <K extends "meeting" | "event" | "occasion">(list: DotItem[], key: K) => list.flatMap(item => item[key] ? [item[key]!] : []) as NonNullable<DotItem[K]>[];
  return [
    ...calendarInputs(pick(shown, "meeting"), view, isMobile, userId, moreLabel, now),
    ...companyEventInputs(pick(shown, "event"), view, now),
    ...occasionInputs(pick(shown, "occasion"), view, title, moreOccasions, false),
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
  const dayOccasions = occasions.filter(occasion => occasion.date === day);
  if (!ofDay && !dayEvents.length && !dayOccasions.length) return null;
  const start = businessUtc(day);
  return {
    key: `day:${day}`, day, startUtc: ofDay?.startUtc ?? start, endUtc: ofDay?.endUtc ?? businessUtc(addDateDays(day, 1)),
    items: ofDay?.items ?? [], events: dayEvents, occasions: dayOccasions,
  };
}
