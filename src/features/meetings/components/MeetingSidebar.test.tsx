import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { MeetingCalendar } from "./MeetingCalendar";
import { SIDEBAR_COLLAPSED_KEY } from "./MeetingSidebar";

/** The desktop calendar's left column: a month to move the calendar, a search and the meetings of the range shown. */
const navigation = vi.hoisted(() => ({ params: new URLSearchParams(), router: { replace: () => {} } as { replace: (href: string, options?: { scroll?: boolean }) => void } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => navigation.params, useRouter: () => navigation.router }));

/** A meeting at business wall-clock `hour` on `day` (2026-10-12 etc.). */
const at = (day: string, hour: number) => new Date(Date.parse(`${day}T00:00:00Z`) + (hour - 7) * 3600000).toISOString();
const meeting = (id: number, title: string, day: string, hour: number, extra: Record<string, unknown> = {}) => ({
  id, title, kindId: 1, kind: "Nội bộ", location: "Phòng 501", startUtc: at(day, hour), endUtc: at(day, hour + 1), organizerId: 2,
  participantCount: 3, status: "Scheduled", color: "#AB3030", isAllDay: false, isException: false, version: 1, seriesSchedule: null, ...extra,
});
const series = { seriesId: 5, color: "#27B450" };
// The week of 12–18 October 2026 (the calendar opens on the 14th), and around it.
const meetings = [
  meeting(1, "Giao ban", "2026-10-12", 9, series),
  meeting(2, "Giao ban", "2026-10-14", 9, series),
  meeting(3, "Giao ban", "2026-10-21", 9, series),
  meeting(10, "Phỏng vấn ứng viên", "2026-10-13", 14, { location: "Phòng Đà Nẵng" }),
  meeting(11, "Đào tạo an toàn", "2026-10-12", 8, { location: "Hội trường", color: "#7B1FBD" }),
  meeting(20, "Tổng kết", "2026-11-03", 9),
];

const urlOf = (input: RequestInfo | URL) => new URL(input instanceof Request ? input.url : String(input), location.href);
/** Answers each read of meetings with those in its range; counts them. */
function serveMeetings() {
  const reads: URL[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async input => {
    const url = urlOf(input);
    if (url.pathname.includes("/Organization/work-week")) return new Response(null, { status: 404 });
    if (!url.searchParams.has("FromUtc")) return Response.json([]);
    reads.push(url);
    const from = Date.parse(url.searchParams.get("FromUtc")!);
    const to = Date.parse(url.searchParams.get("ToUtc")!);
    return Response.json(meetings.filter(m => Date.parse(m.startUtc) < to && Date.parse(m.endUtc) > from));
  });
  return reads;
}
const renderCalendar = () => render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
const sidebar = () => document.querySelector<HTMLElement>(".meeting-sidebar");
const event = (id: number) => document.querySelector<HTMLElement>(`[data-meeting-id="${id}"]`);
/** A day of the shown month in the month calendar. */
const day = (date: number) => [...document.querySelectorAll<HTMLElement>(".meeting-sidebar .calendar__cell")]
  .find(cell => cell.getAttribute("data-outside-month") !== "true" && cell.textContent?.trim() === String(date))!;
/** A row's label, which ticks its (visually hidden) checkbox. */
const rowLabel = (key: string) => document.querySelector<HTMLElement>(`[data-meeting-key="${key}"] [data-slot="checkbox-content"]`)!;
const rowNames = () => [...document.querySelectorAll<HTMLElement>(".meeting-sidebar-list [data-meeting-key]")].map(row => row.dataset.meetingKey);

beforeEach(async () => {
  await page.viewport(1280, 800);
  try { localStorage.removeItem(SIDEBAR_COLLAPSED_KEY); } catch { /* none */ }
  navigation.params = new URLSearchParams("date=2026-10-14");
});
afterEach(async () => { vi.restoreAllMocks(); navigation.params = new URLSearchParams(); await page.viewport(1000, 800); });

test.each([[1280, 800, true], [1000, 800, false], [390, 844, false]])("at %ix%i the sidebar is shown: %s", async (width, height, shown) => {
  await page.viewport(width, height);
  serveMeetings();
  await renderCalendar();
  await vi.waitFor(() => expect(event(10)).not.toBeNull());
  expect(sidebar() !== null).toBe(shown);
  if (!shown) return;
  // Left of the grid, a line between them; the grid keeps the rest.
  const aside = sidebar()!.getBoundingClientRect();
  const grid = document.querySelector(".meeting-grid-scroll")!.getBoundingClientRect();
  expect(aside.right).toBeLessThanOrEqual(grid.left);
  expect(aside.width).toBeGreaterThanOrEqual(15 * 16);
  expect(aside.width).toBeLessThanOrEqual(18 * 16);
  expect(getComputedStyle(sidebar()!).borderRightWidth).toBe("1px");
});

test("the month calendar marks the days with meetings, the calendar's day filled, and a click moves the calendar there", async () => {
  serveMeetings();
  const screen = await renderCalendar();
  await expect.element(screen.getByText("Tháng 10 2026", { exact: true })).toBeVisible();
  // Monday first, as the calendar.
  const weekdays = [...document.querySelectorAll(".meeting-sidebar .calendar__header-cell")].map(cell => cell.textContent);
  expect(weekdays).toEqual(["T2", "T3", "T4", "T5", "T6", "T7", "CN"]);
  await vi.waitFor(() => expect(day(21).querySelector(".calendar__cell-indicator")).not.toBeNull());
  for (const date of [12, 13, 14, 21]) expect(day(date).querySelector(".calendar__cell-indicator"), `the ${date}th`).not.toBeNull();
  for (const date of [15, 3]) expect(day(date).querySelector(".calendar__cell-indicator"), `the ${date}th`).toBeNull();
  expect(day(14).getAttribute("data-selected")).toBe("true");

  // A first click in the frame focuses its window: on a calendar day, React Aria would read that window focus as a node.
  await userEvent.click(screen.getByText("Tháng 10 2026", { exact: true }));
  await userEvent.click(day(21));

  // The toolbar names the week (the month calendar has a heading of its own, for screen readers).
  await expect.element(screen.getByRole("heading", { level: 2, name: /^19 – 25/ })).toBeInTheDocument();
  // Still a week, now the next one: the series is listed at its occurrence there.
  expect(document.querySelector(".fc-timeGridWeek-view")).not.toBeNull();
  await vi.waitFor(() => expect(rowNames()).toEqual(["s5"]));
  expect(day(21).getAttribute("data-selected")).toBe("true");
});

test("the calendar's own navigation moves the month calendar along", async () => {
  serveMeetings();
  const screen = await renderCalendar();
  await expect.element(screen.getByText("Tháng 10 2026", { exact: true })).toBeVisible();
  for (let i = 0; i < 3; i++) await userEvent.click(screen.getByRole("button", { name: "Khoảng sau", exact: true }));
  await expect.element(screen.getByText("Tháng 11 2026", { exact: true })).toBeVisible();
  await vi.waitFor(() => expect(day(3).querySelector(".calendar__cell-indicator")).not.toBeNull());
});

test("the list has one row per meeting or series in the range, by first start, and the search narrows it", async () => {
  serveMeetings();
  const screen = await renderCalendar();
  await vi.waitFor(() => expect(rowNames()).toEqual(["m11", "s5", "m10"]));
  const row = document.querySelector<HTMLElement>('[data-meeting-key="s5"]')!;
  expect(row.textContent).toContain("Giao ban");
  expect(row.textContent).toContain("09:00");
  expect(row.textContent).toContain("Phòng 501");
  expect(row.querySelector("span[title]")?.getAttribute("title")).toBe("Giao ban");

  await userEvent.type(screen.getByRole("searchbox", { name: "Tìm cuộc họp hoặc phòng…" }), "da nang");
  await vi.waitFor(() => expect(rowNames()).toEqual(["m10"]));
  // The calendar itself is not filtered by it.
  expect(event(1)).not.toBeNull();
});

test("unticking a series hides all its occurrences from the grid without asking again, and a reload keeps it hidden", async () => {
  const reads = serveMeetings();
  const replace = vi.spyOn(navigation.router, "replace");
  const screen = await renderCalendar();
  await vi.waitFor(() => expect(event(2)).not.toBeNull());
  const box = screen.getByRole("checkbox", { name: "Giao ban" });
  await expect.element(box).toBeChecked();
  // Ticked: the box is filled with the meeting's colour (#27B450).
  const control = () => document.querySelector<HTMLElement>('[data-meeting-key="s5"] .checkbox__control')!;
  expect(getComputedStyle(control(), "::before").backgroundColor).toBe("rgb(39, 180, 80)");
  const readsBefore = reads.length;

  await userEvent.click(rowLabel("s5"));

  await vi.waitFor(() => expect(event(1)).toBeNull());
  expect(event(2)).toBeNull();
  expect(event(10)).not.toBeNull();
  await expect.element(box).not.toBeChecked();
  // Unticked: an outline in its colour.
  expect(getComputedStyle(control()).borderColor).toBe("rgb(39, 180, 80)");
  expect(reads.filter(url => (Date.parse(url.searchParams.get("ToUtc")!) - Date.parse(url.searchParams.get("FromUtc")!)) / 86400000 === 7)).toHaveLength(1);
  expect(reads.length).toBe(readsBefore);
  await vi.waitFor(() => expect(replace).toHaveBeenLastCalledWith("/meetings?date=2026-10-14&hide=s5", { scroll: false }));
  await screen.unmount();

  navigation.params = new URLSearchParams("date=2026-10-14&hide=s5");
  const again = await renderCalendar();
  await vi.waitFor(() => expect(event(10)).not.toBeNull());
  expect(event(1)).toBeNull();
  await expect.element(again.getByRole("checkbox", { name: "Giao ban" })).not.toBeChecked();
  await userEvent.click(rowLabel("s5"));
  await vi.waitFor(() => expect(event(1)).not.toBeNull());
  expect(event(2)).not.toBeNull();
});

test("hide all, then show all", async () => {
  serveMeetings();
  const screen = await renderCalendar();
  await vi.waitFor(() => expect(event(10)).not.toBeNull());
  await userEvent.click(screen.getByRole("button", { name: "Ẩn tất cả", exact: true }));
  await vi.waitFor(() => expect(document.querySelector("[data-meeting-id]")).toBeNull());
  await userEvent.click(screen.getByRole("button", { name: "Hiện tất cả", exact: true }));
  await vi.waitFor(() => expect([1, 2, 10, 11].every(id => event(id))).toBe(true));
});

test("an empty range says so", async () => {
  navigation.params = new URLSearchParams("date=2026-12-09");
  serveMeetings();
  const screen = await renderCalendar();
  await expect.element(screen.getByText("Không có cuộc họp trong khoảng này", { exact: true })).toBeVisible();
});

test("the sidebar collapses, and stays collapsed after a reload", async () => {
  serveMeetings();
  const screen = await renderCalendar();
  await vi.waitFor(() => expect(sidebar()).not.toBeNull());
  const gridWidth = document.querySelector(".meeting-grid-scroll")!.getBoundingClientRect().width;
  await userEvent.click(screen.getByRole("button", { name: "Ẩn thanh bên", exact: true }));
  await vi.waitFor(() => expect(sidebar()).toBeNull());
  await vi.waitFor(() => expect(document.querySelector(".meeting-grid-scroll")!.getBoundingClientRect().width).toBeGreaterThan(gridWidth + 200));
  await screen.unmount();

  const again = await renderCalendar();
  await expect.element(again.getByRole("button", { name: "Hiện thanh bên", exact: true })).toHaveAttribute("aria-expanded", "false");
  expect(sidebar()).toBeNull();
  await userEvent.click(again.getByRole("button", { name: "Hiện thanh bên", exact: true }));
  await vi.waitFor(() => expect(sidebar()).not.toBeNull());
});
