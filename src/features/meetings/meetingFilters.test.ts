import { expect, test } from "vitest";
import { activeFilterCount, noFilters, readCalendarState, toMeetingQuery, writeCalendarState, layoutOf, rangeOf, viewOf } from "./meetingFilters";

const shared = "view=timeGridDay&date=2026-10-12&q=giao%20ban&mine=1&kind=2&kind=5&location=PH%C3%92NG%20503%2C%20T%E1%BA%A6NG%202";

test("a shared calendar URL is read and written back the same", () => {
  const state = readCalendarState(new URLSearchParams(shared));
  expect(state).toEqual({
    view: "timeGridDay",
    date: "2026-10-12",
    filters: { search: "giao ban", mine: true, kindIds: [2, 5], locations: ["PHÒNG 503, TẦNG 2"] },
    hidden: [],
  });
  const written = writeCalendarState(state);
  expect(readCalendarState(written)).toEqual(state);
  expect([...written]).toEqual([...new URLSearchParams(shared)]);
});

test("invalid values are dropped", () => {
  const state = readCalendarState(new URLSearchParams("view=foo&kind=abc&kind=0&kind=3&date=2026-13-40&mine=yes&location=%20%20"));
  expect(state).toEqual({ view: "timeGridWeek", date: null, filters: { ...noFilters, kindIds: [3] }, hidden: [] });
  expect(readCalendarState(new URLSearchParams("date=2026-02-30")).date).toBeNull();
  // Kind ids are 32-bit on the server: a larger one could not be read there and would fail every load.
  expect(readCalendarState(new URLSearchParams("kind=99999999999&kind=-1&kind=0&kind=2147483648&kind=2147483647")).filters.kindIds).toEqual([2147483647]);
});

test("the meetings and series hidden from the calendar are kept in the URL, after the filters", () => {
  const state = readCalendarState(new URLSearchParams("mine=1&hide=s5&hide=m12"));
  expect(state.hidden).toEqual(["s5", "m12"]);
  expect(writeCalendarState(state).toString()).toBe("mine=1&hide=s5&hide=m12");
  expect(writeCalendarState({ view: "timeGridWeek", date: null, filters: noFilters, hidden: [] }).toString()).toBe("");
  // Anything else is not a meeting or a series: left out, and each one once.
  expect(readCalendarState(new URLSearchParams("hide=x5&hide=s&hide=m-1&hide=s5&hide=s5&hide=m99999999999&hide=m7")).hidden).toEqual(["s5", "m7"]);
});

test("a link to the removed work-week view falls back to the screen's view", () => {
  expect(readCalendarState(new URLSearchParams("view=timeGridWorkWeek")).view).toBe("timeGridWeek");
  expect(readCalendarState(new URLSearchParams("view=listDay")).view).toBe("listDay");
  expect(readCalendarState(new URLSearchParams("view=timeGridWorkWeek"), "dayGridMonth").view).toBe("dayGridMonth");
});

test("without a view in the URL the screen's own view is used, and is left out again", () => {
  expect(readCalendarState(new URLSearchParams("mine=1"), "dayGridMonth").view).toBe("dayGridMonth");
  expect(readCalendarState(new URLSearchParams("view=timeGridWeek"), "dayGridMonth").view).toBe("timeGridWeek");
  expect(writeCalendarState({ view: "dayGridMonth", date: null, filters: noFilters }, "dayGridMonth").toString()).toBe("");
  expect(writeCalendarState({ view: "timeGridWeek", date: null, filters: noFilters }, "dayGridMonth").toString()).toBe("view=timeGridWeek");
});

test("defaults are left out of the URL", () => {
  expect(writeCalendarState({ view: "timeGridWeek", date: null, filters: noFilters }).toString()).toBe("");
  expect(writeCalendarState({ view: "dayGridMonth", date: null, filters: { ...noFilters, search: "  " } }).toString()).toBe("view=dayGridMonth");
});

test("each kind of filter counts once", () => {
  expect(activeFilterCount(noFilters)).toBe(0);
  expect(activeFilterCount({ search: "giao", mine: true, kindIds: [1, 2, 3], locations: ["A", "B"] })).toBe(4);
  expect(activeFilterCount({ ...noFilters, search: "   " })).toBe(0);
});

test("the meetings query carries only the filters that are on", () => {
  expect(toMeetingQuery(noFilters, "a", "b")).toEqual({ fromUtc: "a", toUtc: "b" });
  expect(toMeetingQuery({ search: " giao ", mine: true, kindIds: [2], locations: ["P1"] }, "a", "b"))
    .toEqual({ fromUtc: "a", toUtc: "b", mine: true, kindIds: [2], locations: ["P1"], search: "giao" });
});

test("a view is a range in a layout, both ways", () => {
  const pairs = [["day", "grid", "timeGridDay"], ["week", "grid", "timeGridWeek"], ["month", "grid", "dayGridMonth"],
    ["day", "list", "listDay"], ["week", "list", "listWeek"], ["month", "list", "listMonth"]] as const;
  for (const [range, layout, view] of pairs) {
    expect(viewOf(range, layout)).toBe(view);
    expect(rangeOf(view)).toBe(range);
    expect(layoutOf(view)).toBe(layout);
  }
});
