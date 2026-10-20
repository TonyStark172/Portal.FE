import type { MeetingQuery } from "./meetingTypes";

/** The calendar's views, as FullCalendar names them. */
export const calendarViews = ["timeGridDay", "timeGridWeek", "dayGridMonth", "listDay", "listWeek", "listMonth"] as const;
export type CalendarView = (typeof calendarViews)[number];
/** The view of a wide screen; a narrow one opens on the month (the calendar passes it as the default). */
export const defaultView: CalendarView = "timeGridWeek";
export const isCalendarView = (value: string | null): value is CalendarView => calendarViews.includes(value as CalendarView);

/** A view is a range (a day, a week, a month) shown in a layout (the calendar grid or a list), chosen apart. */
export type CalendarRange = "day" | "week" | "month";
export type CalendarLayout = "grid" | "list";
const views: Record<CalendarLayout, Record<CalendarRange, CalendarView>> = {
  grid: { day: "timeGridDay", week: "timeGridWeek", month: "dayGridMonth" },
  list: { day: "listDay", week: "listWeek", month: "listMonth" },
};
export const viewOf = (range: CalendarRange, layout: CalendarLayout): CalendarView => views[layout][range];
export const rangeOf = (view: string): CalendarRange => view.endsWith("Day") ? "day" : view.endsWith("Week") ? "week" : "month";
export const layoutOf = (view: string): CalendarLayout => view.startsWith("list") ? "list" : "grid";

/** What the calendar shows: meetings, company events, and public holidays and birthdays, the company's too ("occasions"). */
export type CalendarShow = { meetings: boolean; events: boolean; occasions: boolean };
export const allShown: CalendarShow = { meetings: true, events: true, occasions: true };
const showKeys = ["meetings", "events", "occasions"] as const;
const showsAll = (show: CalendarShow) => showKeys.every(key => show[key]);

/**
 * Which meetings the calendar shows (the server filters: title, room, kind and organizer, ignoring case and accents),
 * and which of meetings, events and occasions it shows at all.
 */
export type MeetingFilters = { search: string; mine: boolean; kindIds: number[]; locations: string[]; show: CalendarShow };
/**
 * What the page URL keeps: the view, the date shown (null: today), the filters, and the meetings and series hidden
 * from the calendar (their keys, meetingList.ts; a desktop's sidebar hides them here, without asking the server).
 */
export type CalendarState = { view: CalendarView; date: string | null; filters: MeetingFilters; hidden: string[] };
export const noFilters: MeetingFilters = { search: "", mine: false, kindIds: [], locations: [], show: allShown };

// What the server accepts (GetMeetingsQueryValidator); a longer or larger value in a URL is left out.
const maxValues = 50;
const maxLocationLength = 200;
const maxSearchLength = 100;
const maxKindId = 2_147_483_647; // a 32-bit id on the server
// Hidden meetings and series ("s12", "m345"): as many as a URL keeps comfortably.
const maxHidden = 200;
const hiddenKey = /^[sm][1-9]\d{0,9}$/;

/** A real calendar date written yyyy-mm-dd. */
function isDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Reads the calendar from a URL query; unknown or invalid values are ignored, a missing view is `screenView`. */
export function readCalendarState(params: URLSearchParams, screenView: CalendarView = defaultView): CalendarState {
  const view = params.get("view");
  const date = params.get("date");
  const kindIds = params.getAll("kind").filter(value => /^\d+$/.test(value)).map(Number).filter(id => id > 0 && id <= maxKindId);
  const locations = params.getAll("location").map(value => value.trim()).filter(value => value && value.length <= maxLocationLength);
  const hidden = params.getAll("hide").filter(value => hiddenKey.test(value) && Number(value.slice(1)) <= maxKindId);
  // Only what is shown is named; nothing valid named (or nothing at all) is everything.
  const named = params.getAll("show");
  const show = Object.fromEntries(showKeys.map(key => [key, named.includes(key)])) as CalendarShow;
  return {
    view: isCalendarView(view) ? view : screenView,
    date: isDate(date) ? date : null,
    filters: {
      search: (params.get("q") ?? "").slice(0, maxSearchLength),
      mine: params.get("mine") === "1",
      kindIds: [...new Set(kindIds)].slice(0, maxValues),
      locations: [...new Set(locations)].slice(0, maxValues),
      show: showKeys.some(key => show[key]) ? show : allShown,
    },
    hidden: [...new Set(hidden)].slice(0, maxHidden),
  };
}

/**
 * Writes the calendar as a URL query: view, date, q, mine=1, kind, location, show (what is shown, unless everything is)
 * and hide (repeated), leaving out defaults; the view is left out only when it is `screenView`, the one the same screen opens without it.
 */
export function writeCalendarState({ view, date, filters, hidden = [] }: Omit<CalendarState, "hidden"> & { hidden?: string[] }, screenView: CalendarView = defaultView): URLSearchParams {
  const params = new URLSearchParams();
  if (view !== screenView) params.set("view", view);
  if (date) params.set("date", date);
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.mine) params.set("mine", "1");
  filters.kindIds.forEach(id => params.append("kind", String(id)));
  filters.locations.forEach(location => params.append("location", location));
  if (!showsAll(filters.show)) showKeys.filter(key => filters.show[key]).forEach(key => params.append("show", key));
  hidden.forEach(key => params.append("hide", key));
  return params;
}

/** How many filters are on (a search, "mine", kinds, places, not showing everything: each counts once). */
export const activeFilterCount = (filters: MeetingFilters) =>
  [filters.search.trim() !== "", filters.mine, filters.kindIds.length > 0, filters.locations.length > 0, !showsAll(filters.show)].filter(Boolean).length;

/** The meetings request for a window of time, carrying only the filters that are on. */
export function toMeetingQuery(filters: MeetingFilters, fromUtc: string, toUtc: string): MeetingQuery {
  const query: MeetingQuery = { fromUtc, toUtc };
  const search = filters.search.trim();
  if (filters.mine) query.mine = true;
  if (filters.kindIds.length) query.kindIds = filters.kindIds;
  if (filters.locations.length) query.locations = filters.locations;
  if (search) query.search = search;
  return query;
}
