import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { cdp, page, userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { MeetingCalendar } from "./MeetingCalendar";
import { SIDEBAR_COLLAPSED_KEY } from "./MeetingSidebar";

/** A meeting is upcoming, ongoing (marked live) or finished (faded, struck through), by the business clock. */
const navigation = vi.hoisted(() => ({ params: new URLSearchParams(), router: { replace: () => {} } as { replace: (href: string, options?: { scroll?: boolean }) => void } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => navigation.params, useRouter: () => navigation.router }));

/** Business wall-clock `hour` (and `minute`) on `day` as an instant (UTC+7). */
const at = (day: string, hour: number, minute = 0) => new Date(Date.parse(`${day}T00:00:00Z`) + ((hour - 7) * 60 + minute) * 60000).toISOString();
const meeting = (id: number, title: string, day: string, from: number, to: number, extra: Record<string, unknown> = {}) => ({
  id, title, kindId: 1, kind: "Nội bộ", location: "Phòng 501", startUtc: at(day, from), endUtc: at(day, to), organizerId: 2,
  participantCount: 3, status: "Scheduled", color: "#AB3030", isAllDay: false, isException: false, version: 1, seriesSchedule: null, ...extra,
});
const allDay = (id: number, title: string, day: string) => meeting(id, title, day, 0, 24, { isAllDay: true });
// At 10:30 on Wednesday 14 October 2026: 1 and 5 are over, 2 and 4 are on, 3 is to come.
const meetings = [
  meeting(1, "Giao ban", "2026-10-14", 8, 9),
  meeting(2, "Phỏng vấn", "2026-10-14", 10, 11),
  meeting(3, "Tổng kết", "2026-10-14", 14, 15),
  allDay(4, "Hội thảo", "2026-10-14"),
  allDay(5, "Tập huấn", "2026-10-13"),
];
const finished = [1, 5];
const ongoing = [2, 4];
const upcoming = [3];

const urlOf = (input: RequestInfo | URL) => new URL(input instanceof Request ? input.url : String(input), location.href);
/** Answers each read of meetings with those of `served` in its range; counts the calendar's reads. */
function serveMeetings(served = meetings) {
  const reads: URL[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async input => {
    const url = urlOf(input);
    if (url.pathname.includes("/Organization/work-week")) return new Response(null, { status: 404 });
    if (url.pathname.includes("/participants")) return Response.json({ items: [], totalCount: 0, missingEmailCount: 0, pageNumber: 1 });
    if (!url.searchParams.has("FromUtc")) return Response.json([]);
    reads.push(url);
    const from = Date.parse(url.searchParams.get("FromUtc")!);
    const to = Date.parse(url.searchParams.get("ToUtc")!);
    return Response.json(served.filter(m => Date.parse(m.startUtc) < to && Date.parse(m.endUtc) > from));
  });
  return reads;
}
const renderCalendar = () => render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
/** The meeting's events on the calendar (one per day or week it spans). */
const cards = (id: number) => [...document.querySelectorAll<HTMLElement>(`.fc [data-meeting-id="${id}"]`)];
const titleOf = (card: HTMLElement) => card.querySelector<HTMLElement>(".fc-event-title, .fc-list-event-title, .meeting-compact-title, .meeting-event-title")!;
const rowOf = (key: string) => document.querySelector<HTMLElement>(`[data-meeting-key="${key}"]`)!;
const struck = (element: Element) => getComputedStyle(element).textDecorationLine.includes("line-through");

beforeEach(async () => {
  await page.viewport(1280, 800);
  try { localStorage.removeItem(SIDEBAR_COLLAPSED_KEY); } catch { /* none */ }
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date(at("2026-10-14", 10, 30)));
});
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  navigation.params = new URLSearchParams();
  await page.viewport(1000, 800);
});

test.each(["timeGridWeek", "dayGridMonth", "listWeek"])("in %s each meeting shows its state, in its class and its accessible name", async view => {
  navigation.params = new URLSearchParams(`view=${view}&date=2026-10-14`);
  serveMeetings();
  await renderCalendar();
  await vi.waitFor(() => expect(cards(3)).not.toHaveLength(0));

  for (const id of finished) for (const card of cards(id)) {
    expect(card.classList).toContain("meeting-finished");
    expect(card.getAttribute("aria-label")).toContain("(đã kết thúc)");
    // Faded and struck through, still a meeting to open.
    expect(Number(getComputedStyle(card).opacity)).toBeCloseTo(0.5, 1);
    expect(struck(titleOf(card))).toBe(true);
    expect(card.querySelector(".meeting-live-tag")).toBeNull();
  }
  for (const id of ongoing) for (const card of cards(id)) {
    expect(card.classList).toContain("meeting-ongoing");
    expect(card.getAttribute("aria-label")).toContain("(đang họp)");
    expect(Number(getComputedStyle(card).opacity)).toBe(1);
    // A red pulsing dot before the title and a short tag.
    const dot = card.querySelector<HTMLElement>(".meeting-live-dot")!;
    expect(dot).not.toBeNull();
    expect(getComputedStyle(dot).animationName).toBe("meeting-live-pulse");
    expect(card.querySelector(".meeting-live-tag")?.textContent).toBe("Đang họp");
    expect(card.textContent).toContain(meetings.find(m => m.id === id)!.title);
  }
  for (const id of upcoming) for (const card of cards(id)) {
    expect(card.classList).not.toContain("meeting-finished");
    expect(card.classList).not.toContain("meeting-ongoing");
    expect(card.getAttribute("aria-label")).not.toMatch(/đang họp|đã kết thúc/);
    expect(struck(titleOf(card))).toBe(false);
  }
});

test("in the grids an ongoing meeting is ringed in its own colour", async () => {
  navigation.params = new URLSearchParams("date=2026-10-14");
  serveMeetings();
  await renderCalendar();
  await vi.waitFor(() => expect(cards(2)).toHaveLength(1));
  const ring = getComputedStyle(cards(2)[0]).boxShadow;
  expect(ring).toContain("rgb(171, 48, 48)");
  expect(getComputedStyle(cards(3)[0]).boxShadow).not.toContain("rgb(171, 48, 48)");
});

test("the state follows the clock: a meeting crossing its end is shown finished within 30 s, without asking the server", async () => {
  // 10:59:45: meeting 2 ends at 11:00.
  vi.setSystemTime(Date.parse(at("2026-10-14", 10, 59)) + 45_000);
  navigation.params = new URLSearchParams("date=2026-10-14");
  const reads = serveMeetings();
  await renderCalendar();
  await vi.waitFor(() => expect(cards(2)[0]?.classList).toContain("meeting-ongoing"));
  await vi.waitFor(() => expect(rowOf("m2")?.textContent).toContain("Đang họp"));
  const before = reads.length;

  vi.advanceTimersByTime(30_000);

  await vi.waitFor(() => expect(cards(2)[0].classList).toContain("meeting-finished"));
  expect(cards(2)[0].getAttribute("aria-label")).toContain("(đã kết thúc)");
  await vi.waitFor(() => expect(cards(2)[0].querySelector(".meeting-live-dot")).toBeNull());
  await vi.waitFor(() => expect(rowOf("m2").textContent).not.toContain("Đang họp"));
  expect(reads.length).toBe(before);
});

test("the sidebar's rows: a finished one faded and struck through, an ongoing one tagged", async () => {
  navigation.params = new URLSearchParams("date=2026-10-14");
  serveMeetings();
  await renderCalendar();
  await vi.waitFor(() => expect(rowOf("m3")).not.toBeNull());

  for (const id of finished) {
    const row = rowOf(`m${id}`);
    expect(row.textContent).toContain("(đã kết thúc)");
    expect(Number(getComputedStyle(row.querySelector("[data-slot='checkbox-content']")!).opacity)).toBeCloseTo(0.5, 1);
    expect(struck(row.querySelector(".meeting-row-title")!)).toBe(true);
  }
  for (const id of ongoing) {
    const row = rowOf(`m${id}`);
    expect(row.querySelector(".meeting-live-tag")?.textContent).toBe("Đang họp");
    expect(struck(row.querySelector(".meeting-row-title")!)).toBe(false);
  }
  expect(rowOf("m3").textContent).not.toMatch(/Đang họp|đã kết thúc/);
});

test("a meeting's details say whether it is on or over", async () => {
  navigation.params = new URLSearchParams("date=2026-10-14");
  serveMeetings();
  const screen = await renderCalendar();
  await vi.waitFor(() => expect(cards(3)).toHaveLength(1));

  await userEvent.click(cards(2)[0]);
  const live = screen.getByRole("dialog", { name: "Phỏng vấn" });
  await expect.element(live.getByText("Đang họp", { exact: true })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Đóng", exact: true }));
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());

  await userEvent.click(cards(1)[0]);
  const over = screen.getByRole("dialog", { name: "Giao ban" });
  await expect.element(over.getByText("Đã kết thúc", { exact: true })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Đóng", exact: true }));
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());

  await userEvent.click(cards(3)[0]);
  const later = screen.getByRole("dialog", { name: "Tổng kết" });
  await expect.element(later.getByRole("heading")).toBeVisible();
  expect(later.element().textContent).not.toMatch(/Đang họp|Đã kết thúc/);
});

test("with reduced motion the live dot does not pulse", async () => {
  await cdp().send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  try {
    navigation.params = new URLSearchParams("date=2026-10-14");
    serveMeetings();
    await renderCalendar();
    await vi.waitFor(() => expect(cards(2)[0]?.querySelector(".meeting-live-dot") ?? null).not.toBeNull());
    expect(getComputedStyle(cards(2)[0].querySelector(".meeting-live-dot")!).animationName).toBe("none");
  } finally {
    await cdp().send("Emulation.setEmulatedMedia", { features: [] });
  }
});

test("on a phone a finished meeting's dot is faded, an ongoing one pulses, and the day's list shows both", async () => {
  await page.viewport(390, 844);
  navigation.params = new URLSearchParams("date=2026-10-14");
  serveMeetings(meetings.filter(m => m.id !== 4));
  const screen = await renderCalendar();
  const cell = () => document.querySelector<HTMLElement>('.fc-daygrid-day[data-date="2026-10-14"]')!;
  await vi.waitFor(() => expect(cell().querySelectorAll(".meeting-dot")).toHaveLength(3));

  const [over, live, later] = [1, 2, 3].map(id => cell().querySelector<HTMLElement>(`[data-meeting-id="${id}"]`)!);
  expect(Number(getComputedStyle(over).opacity)).toBeCloseTo(0.5, 1);
  expect(over.getAttribute("aria-label")).toContain("(đã kết thúc)");
  expect(getComputedStyle(live.querySelector(".meeting-dot")!).animationName).toBe("meeting-live-pulse");
  expect(live.getAttribute("aria-label")).toContain("(đang họp)");
  expect(Number(getComputedStyle(later).opacity)).toBe(1);
  expect(getComputedStyle(later.querySelector(".meeting-dot")!).animationName).toBe("none");

  await userEvent.click(cell().querySelector(".fc-daygrid-day-top")!);
  const list = screen.getByRole("dialog");
  await expect.element(list.getByRole("button", { name: /Giao ban.*đã kết thúc/ })).toBeVisible();
  await expect.element(list.getByRole("button", { name: /Phỏng vấn.*Đang họp/ })).toBeVisible();
  const first = list.getByRole("button", { name: /Giao ban/ }).element();
  expect(struck(first.querySelector(".meeting-row-title")!)).toBe(true);
});

test("in a list each title says its state and opens its meeting from the keyboard", async () => {
  navigation.params = new URLSearchParams("view=listWeek&date=2026-10-14");
  serveMeetings();
  const screen = await renderCalendar();
  await vi.waitFor(() => expect(cards(3)).toHaveLength(1));
  const title = (id: number) => cards(id)[0].querySelector<HTMLElement>(".fc-list-event-title [tabindex='0']")!;
  expect(title(1).textContent).toContain("(đã kết thúc)");
  expect(title(2).textContent).toContain("Đang họp");
  expect(title(3).textContent).not.toMatch(/Đang họp|đã kết thúc/);

  title(2).focus();
  await userEvent.keyboard("{Enter}");
  await expect.element(screen.getByRole("dialog", { name: "Phỏng vấn" })).toBeVisible();
});
