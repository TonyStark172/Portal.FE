import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { MeetingCalendar } from "./MeetingCalendar";
import MeetingsPage from "@/app/(portal)/meetings/page";
import { page, userEvent } from "vitest/browser";
import { signedIn } from "@/shared/session/sessionSlice";
import { Toast, toast } from "@heroui/react";
import { portalApi, type UserDto } from "@/shared/api/generated/portalApi";

/** The page's URL as Next.js hands it to the calendar, and the router it writes the URL back with. */
const navigation = vi.hoisted(() => ({ params: new URLSearchParams(), router: { replace: () => {} } as { replace: (href: string, options?: { scroll?: boolean }) => void } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => navigation.params, useRouter: () => navigation.router }));
// A desktop's screen unless a test says otherwise (the test browser's own 1000px is a tablet's: breakpoints.ts).
beforeEach(async () => { await page.viewport(1280, 800); });
afterEach(async () => { vi.restoreAllMocks(); toast.clear(); navigation.params = new URLSearchParams(); await page.viewport(1000, 800); });
const urlOfCall = ([input]: unknown[]) => new URL(input instanceof Request ? input.url : String(input), location.href);
const methodOfCall = ([input, init]: unknown[]) => input instanceof Request ? input.method : (init as RequestInit | undefined)?.method ?? "GET";
/** A desktop sidebar's month calendar asks for a whole month (1st to 1st, business time) to mark its days. */
const isMonthRead = (url: URL) => ["FromUtc", "ToUtc"].every(name => {
  const value = url.searchParams.get(name);
  return value !== null && new Date(Date.parse(value) + 7 * 3600000).toISOString().endsWith("-01T00:00:00.000Z");
});
/** The calendar grid's own reads of meetings (the ones with a range), not the month calendar's. */
const calendarReads = (calls: unknown[][]) => calls.filter(call => urlOfCall(call).searchParams.has("FromUtc") && !isMonthRead(urlOfCall(call)));
/** Calls `handler` with the URL and init of what RTK Query hands fetch (a Request), as plain fetch calls had them. */
const withRequest = (handler: (url: string, init: { method: string; body: string | null; signal: AbortSignal }) => Promise<Response> | Response) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    return handler(request.url, { method: request.method, body: ["GET", "HEAD"].includes(request.method) ? null : await request.clone().text(), signal: request.signal });
  };


test("resizing the all-day end handle to 23:00 sends one timed occurrence update", async () => {
  const wallStart = new Date(Date.now() + 7 * 3600000); wallStart.setUTCHours(0, 0, 0, 0);
  const startUtc = new Date(wallStart.getTime() - 7 * 3600000).toISOString();
  const endUtc = new Date(wallStart.getTime() + 17 * 3600000).toISOString();
  let meeting = { id: 7, title: "Họp cả ngày", kindId: 1, kind: "Nội bộ", location: "501", startUtc, endUtc, organizerId: 2, participantIds: [3], isAllDay: true, version: 4 };
  const writes: { scope: string; details: { schedule: { startUtc: string; endUtc: string; isAllDay: boolean }; participantIds: null } }[] = [];
  let finishSave!: () => void;
  const pendingSave = new Promise<void>(resolve => { finishSave = resolve; });
  vi.spyOn(window, "fetch").mockImplementation(withRequest(async (_url, init) => {
    if (init?.method === "PUT") {
      const request = JSON.parse(String(init.body)); writes.push(request);
      meeting = { ...meeting, ...request.details.schedule, version: 5 };
      await pendingSave;
      return Response.json({ anchorId: 7, affectedCount: 1, version: 5, mutationId: request.details.mutationId });
    }
    return Response.json([meeting]);
  }));
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: 2, fullName: "Người tổ chức" } as UserDto, permissions: [] }));
  const screen = await render(<Provider store={store}><MeetingCalendar /></Provider>);
  await userEvent.click(screen.getByRole("tab", { name: "Ngày", exact: true }));
  await vi.waitFor(() => expect(document.querySelector('[data-meeting-id="7"] .fc-event-resizer-end')).not.toBeNull());
  const scroller = document.querySelector<HTMLElement>(".fc-scrollgrid-section-liquid .fc-scroller")!;
  scroller.scrollTop = scroller.scrollHeight;
  const handle = document.querySelector<HTMLElement>('[data-meeting-id="7"] .fc-event-resizer-end')!;
  const slot = document.querySelector<HTMLElement>('.fc-timegrid-slot-lane[data-time="22:30:00"]')!;
  const previews = new Set<string>();
  const observer = new MutationObserver(() => {
    document.querySelectorAll(".meeting-resize-preview").forEach(preview => previews.add(preview.textContent ?? ""));
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  try { await userEvent.dragAndDrop(handle, slot); } finally { observer.disconnect(); }
  expect([...previews].some(preview => preview.includes("23:00"))).toBe(true);
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toMatchObject({ scope: "Occurrence", details: { participantIds: null, schedule: {
    startUtc, endUtc: new Date(wallStart.getTime() + 16 * 3600000).toISOString(), isAllDay: false,
  } } });
  try {
    await vi.waitFor(() => expect(getComputedStyle(document.querySelector<HTMLElement>('[data-meeting-id="7"]')!).pointerEvents).toBe("none"));
  } finally { finishSave(); }
  await vi.waitFor(() => expect(getComputedStyle(document.querySelector<HTMLElement>('[data-meeting-id="7"]')!).pointerEvents).not.toBe("none"));
});

test.each([15, 60])("resize grips never appear, including edge hover, and leave a draggable body for a %i-minute meeting", async minutes => {
  const wallStart = new Date(Date.now() + 7 * 3600000); wallStart.setUTCHours(10, 0, 0, 0);
  const startUtc = new Date(wallStart.getTime() - 7 * 3600000).toISOString();
  const endUtc = new Date(wallStart.getTime() - 7 * 3600000 + minutes * 60000).toISOString();
  vi.spyOn(window, "fetch").mockImplementation(withRequest(async () => Response.json([
    { id: 7, title: "Họp ngắn", kindId: 1, kind: "Nội bộ", location: "501", startUtc, endUtc, organizerId: 2, participantIds: [], isAllDay: false, version: 1 },
  ])));
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: 2, fullName: "Người dùng" } as UserDto, permissions: [] }));
  const screen = await render(<Provider store={store}><MeetingCalendar /></Provider>);
  await userEvent.click(screen.getByRole("tab", { name: "Ngày", exact: true }));
  await vi.waitFor(() => expect(document.querySelector('[data-meeting-id="7"]')).not.toBeNull());
  const card = document.querySelector<HTMLElement>('[data-meeting-id="7"]')!;
  const top = card.querySelector<HTMLElement>(".fc-event-resizer-start")!;
  const bottom = card.querySelector<HTMLElement>(".fc-event-resizer-end")!;
  expect(top.getBoundingClientRect().bottom).toBeLessThan(bottom.getBoundingClientRect().top);
  await userEvent.hover(card);
  for (const handle of [top, bottom]) expect(getComputedStyle(handle, "::after").opacity).toBe("0");
  const box = card.getBoundingClientRect();
  expect(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest(".fc-event-resizer")).toBeNull();
  await userEvent.hover(bottom);
  expect(getComputedStyle(bottom, "::after").opacity).toBe("0");
  expect(getComputedStyle(top, "::after").opacity).toBe("0");
  // FullCalendar applies this state after touch long-press selection.
  card.classList.add("fc-event-selected");
  await userEvent.hover(card);
  for (const handle of [top, bottom]) {
    expect(getComputedStyle(handle).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(handle, "::before").content).toBe("none");
    expect(getComputedStyle(handle, "::after").opacity).toBe("0");
  }
  expect(top.getBoundingClientRect().bottom).toBeLessThan(bottom.getBoundingClientRect().top);
  await userEvent.hover(bottom);
  expect(getComputedStyle(bottom, "::after").opacity).toBe("0");
});

test.each([2, 3])("all-day time-grid resize handles are exposed only to their owner (user %i)", async userId => {
  const wallStart = new Date(Date.now() + 7 * 3600000); wallStart.setUTCHours(0, 0, 0, 0);
  const startUtc = new Date(wallStart.getTime() - 7 * 3600000).toISOString();
  const endUtc = new Date(wallStart.getTime() + 17 * 3600000).toISOString();
  vi.spyOn(window, "fetch").mockImplementation(withRequest(async () => Response.json([
    { id: 7, title: "Cả ngày thử", kindId: 1, kind: "Nội bộ", location: "501", startUtc, endUtc, organizerId: 2, participantIds: [], isAllDay: true, version: 1 },
  ])));
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: userId, fullName: "Người dùng" } as UserDto, permissions: [] }));
  await render(<Provider store={store}><MeetingCalendar /></Provider>);
  await vi.waitFor(() => expect(document.querySelector('[data-meeting-id="7"]')).not.toBeNull());
  const card = document.querySelector<HTMLElement>('[data-meeting-id="7"]')!;
  expect(card.classList.contains("fc-event-draggable")).toBe(false);
  const handles = card.querySelectorAll<HTMLElement>(".fc-event-resizer");
  expect(handles.length).toBe(userId === 2 ? 2 : 0);
  for (const handle of handles) expect(handle.getBoundingClientRect().height).toBeGreaterThanOrEqual(12);
});

test.each([320, 390])("mobile calendar starts in month view with unclipped controls at %ipx", async width => {
  await page.viewport(width, 844);
  try {
    vi.spyOn(window, "fetch").mockImplementation(withRequest(async () => Response.json([])));
    const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
    // On a phone the views are a switch at the bottom of the screen, not in the toolbar.
    await expect.element(screen.getByRole("tab", { name: "Tháng", exact: true })).toHaveAttribute("aria-selected", "true");
    expect(document.querySelector(".meeting-toolbar [role=tab]")).toBeNull();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    for (const element of document.querySelectorAll<HTMLElement>(".meeting-toolbar button")) {
      const box = element.getBoundingClientRect();
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
    }
    await userEvent.click(screen.getByRole("tab", { name: "Tuần", exact: true }));
    await vi.waitFor(() => expect(document.querySelector(".fc-timeGridWeek-view")).not.toBeNull());
    const scroller = document.querySelector<HTMLElement>(".meeting-grid-scroll")!;
    // The week fits the phone: no sideways scrolling.
    expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth + 1);
    await userEvent.click(screen.getByRole("tab", { name: "Ngày", exact: true }));
    await vi.waitFor(() => expect(document.querySelector(".fc-timeGridDay-view")).not.toBeNull());
    expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth + 1);
  } finally { await page.viewport(1000, 800); }
});

test("keeps the header fixed without an all-day row while the time grid remains scrollable", async () => {
  vi.spyOn(window, "fetch").mockImplementation(withRequest(async () => Response.json([])));
  await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  const fixedRows = [...document.querySelectorAll<HTMLElement>(".fc-scrollgrid-section-header .fc-scroller, .fc-scrollgrid-section-body:not(.fc-scrollgrid-section-liquid) .fc-scroller")];
  expect(fixedRows.length).toBe(1);
  fixedRows.forEach((row) => expect(getComputedStyle(row).overflowY).toBe("hidden"));
  const grid = document.querySelector<HTMLElement>(".fc-scrollgrid-section-liquid .fc-scroller")!;
  expect(getComputedStyle(grid).overflowY).toBe("scroll");
  expect(grid.scrollHeight).toBeGreaterThan(grid.clientHeight);
});

test.each([900, 320])("keeps every view tab label on one line inside a %ipx calendar", async (width) => {
  vi.spyOn(window, "fetch").mockImplementation(withRequest(async () => Response.json([])));
  await render(<Provider store={makeStore()}><div style={{ width }}><MeetingCalendar /></div></Provider>);
  // The range tabs (the calendar/list tabs beside them are icons, no words).
  await vi.waitFor(() => expect(document.querySelectorAll('.meeting-view-switch [role="tab"]').length).toBe(3));
  for (const tab of document.querySelectorAll<HTMLElement>('.meeting-view-switch [role="tab"]')) {
    const text = [...tab.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)!;
    const range = document.createRange();
    range.selectNodeContents(text);
    expect(range.getClientRects().length).toBe(1);
    const label = range.getBoundingClientRect();
    const bounds = tab.getBoundingClientRect();
    expect(label.top).toBeGreaterThanOrEqual(bounds.top);
    expect(label.bottom).toBeLessThanOrEqual(bounds.bottom);
  }
});

test("loads only the calendar's visible range, once", async () => {
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async () => Response.json([]));
  await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await vi.waitFor(() => expect(calendarReads(fetches.mock.calls)).toHaveLength(1));
  await new Promise(resolve => setTimeout(resolve, 300));
  expect(calendarReads(fetches.mock.calls)).toHaveLength(1);
  const url = urlOfCall(calendarReads(fetches.mock.calls)[0]);
  const from = new Date(url.searchParams.get("FromUtc")!);
  const to = new Date(url.searchParams.get("ToUtc")!);
  expect((to.getTime() - from.getTime()) / 86400000).toBe(7);
  expect(document.querySelector('[role="tab"][id$="-tab-week"]')?.getAttribute("aria-selected")).toBe("true");
});

test("switching to the month asks once, for the month's weeks", async () => {
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async () => Response.json([]));
  const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await vi.waitFor(() => expect(calendarReads(fetches.mock.calls)).toHaveLength(1));
  await userEvent.click(screen.getByRole("tab", { name: "Tháng", exact: true }));
  await vi.waitFor(() => expect(calendarReads(fetches.mock.calls)).toHaveLength(2));
  await new Promise(resolve => setTimeout(resolve, 300));
  expect(calendarReads(fetches.mock.calls)).toHaveLength(2);
  const url = urlOfCall(calendarReads(fetches.mock.calls)[1]);
  expect((Date.parse(url.searchParams.get("ToUtc")!) - Date.parse(url.searchParams.get("FromUtc")!)) / 86400000).toBe(42);
});

test("a crowded time slot shows a few meetings and lists the others behind '+N'", async () => {
  const wallStart = new Date(Date.now() + 7 * 3600000); wallStart.setUTCHours(10, 0, 0, 0);
  const startUtc = new Date(wallStart.getTime() - 7 * 3600000).toISOString();
  const endUtc = new Date(wallStart.getTime() - 6 * 3600000).toISOString();
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json(Array.from({ length: 10 }, (_, i) => (
    { id: i + 1, title: `Họp ${i + 1}`, kindId: 1, kind: "Nội bộ", location: `P${i + 1}`, startUtc, endUtc, organizerId: 9, participantCount: 0, isAllDay: false, version: 1 }))));
  const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await expect.element(screen.getByText("+7 cuộc họp")).toBeVisible();
  expect(document.querySelectorAll(".fc-timegrid-event").length).toBe(4);
  await userEvent.click(screen.getByText("+7 cuộc họp"));
  await expect.element(screen.getByRole("button", { name: /Họp 10/ })).toBeVisible();
  expect(document.querySelectorAll('[role="dialog"] li').length).toBe(7);
});

test("shows a load failure through the shared toast, not a calendar banner, and lets the user retry", async () => {
  const fetches = vi.spyOn(window, "fetch").mockImplementation(withRequest(async () => new Response("stacktrace", { status: 500 })));
  const screen = await render(<Provider store={makeStore()}><Toast.Provider /><MeetingCalendar /></Provider>);
  await expect.element(screen.getByRole("alertdialog")).toHaveTextContent("Đã có lỗi xảy ra");
  expect(document.querySelector('.meeting-calendar [role="alert"]')).toBeNull();
  expect(document.body.textContent).not.toContain("stacktrace");
  await expect.element(screen.getByRole("button", { name: "Thử lại" })).toBeVisible();
  fetches.mockImplementation(withRequest(async () => Response.json([])));
  await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  await vi.waitFor(() => expect(calendarReads(fetches.mock.calls)).toHaveLength(2));
});

test("a session that cannot be renewed signs out without an error toast", async () => {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "expired", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  vi.spyOn(window, "fetch").mockImplementation(async () => new Response(null, { status: 401 }));
  await render(<Provider store={store}><Toast.Provider /><MeetingCalendar /></Provider>);
  await vi.waitFor(() => expect(store.getState().session.status).toBe("anonymous"));
  await new Promise(resolve => setTimeout(resolve, 300));
  expect(document.querySelector('[role="alertdialog"]:not([data-exiting])')).toBeNull();
});

test("repeated failed calendar loads do not stack identical error toasts", async () => {
  const fetches = vi.spyOn(window, "fetch").mockImplementation(withRequest(async () => new Response(null, { status: 500 })));
  const screen = await render(<Provider store={makeStore()}><Toast.Provider /><MeetingCalendar /></Provider>);
  await expect.element(screen.getByRole("alertdialog")).toBeVisible();
  await userEvent.click(screen.getByRole("tab", { name: "Tháng", exact: true }));
  await vi.waitFor(() => expect(fetches.mock.calls.length).toBeGreaterThanOrEqual(2));
  expect(document.querySelectorAll('[role="alertdialog"]:not([data-exiting])')).toHaveLength(1);
});

test("closing an error toast allows a later identical failure to notify again", async () => {
  const fetches = vi.spyOn(window, "fetch").mockImplementation(withRequest(async () => new Response(null, { status: 500 })));
  const screen = await render(<Provider store={makeStore()}><Toast.Provider /><MeetingCalendar /></Provider>);
  await expect.element(screen.getByRole("alertdialog")).toBeVisible();
  toast.clear();
  await vi.waitFor(() => expect(document.querySelectorAll('[role="alertdialog"]:not([data-exiting])')).toHaveLength(0));
  await userEvent.click(screen.getByRole("tab", { name: "Tháng", exact: true }));
  await vi.waitFor(() => expect(fetches.mock.calls.length).toBeGreaterThanOrEqual(2));
  await vi.waitFor(() => expect(document.querySelectorAll('[role="alertdialog"]:not([data-exiting])')).toHaveLength(1));
});

test("opens meeting details without sending any mutation request", async () => {
  const start = new Date(); start.setHours(10, 0, 0, 0);
  const fetches = vi.spyOn(window, "fetch").mockImplementation(withRequest(async url => url.includes("/participants")
    ? Response.json({ items: [{ userId: 3, fullName: "Nguyễn Văn An" }], totalCount: 1, missingEmailCount: 0, pageNumber: 1 })
    : Response.json([
      { id: 7, title: "Họp đối tác", kindId: 2, kind: "Đối tác", location: "Phòng B", startUtc: start.toISOString(), endUtc: new Date(start.getTime() + 3600000).toISOString(), organizerId: 2, participantCount: 1 },
    ])));
  const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await userEvent.click(screen.getByText("Họp đối tác · Phòng B", { exact: true }));
  await expect.element(screen.getByRole("dialog", { name: "Họp đối tác" })).toBeVisible();
  expect(document.body.textContent).toContain("Đối tác");
  expect(fetches.mock.calls.every(call => methodOfCall(call) === "GET")).toBe(true);
});

test("lets the organizer edit prefilled details and sends PUT, not a second booking", async () => {
  const start = new Date(); start.setHours(10, 0, 45, 123);
  const originalStartUtc = start.toISOString();
  const originalEndUtc = new Date(start.getTime() + 3600000).toISOString();
  let meeting = { id: 7, version: 1, isAllDay: false, title: "Họp đối tác", kindId: 2, kind: "Đối tác", location: "Phòng B", startUtc: originalStartUtc, endUtc: originalEndUtc, organizerId: 2, participantCount: 2 };
  const people = { items: [{ userId: 2, fullName: "Người tổ chức" }, { userId: 3, fullName: "Nguyễn Văn An" }], totalCount: 2, missingEmailCount: 0, pageNumber: 1 };
  const writes: { method: string; url: string; body: { scope: string; details: Record<string, unknown> & { schedule: Record<string, unknown> } } }[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withRequest(async (url, init) => {
    if (init.method !== "GET") {
      const body = JSON.parse(init.body!);
      writes.push({ method: init.method, url, body });
      meeting = { ...meeting, ...body.details, ...body.details.schedule };
      return Response.json({ anchorMeetingId: 7, mutationId: body.details.mutationId, affectedCount: 1, version: 2, seriesVersion: null });
    }
    if (url.includes("/MeetingKinds")) return Response.json([{ id: 1, name: "Họp nội bộ", isActive: true }, { id: 2, name: "Đối tác", isActive: true }]);
    if (url.includes("/audience/departments")) return Response.json([]);
    if (url.includes("/7/audience")) return Response.json({ userIds: [2, 3], departmentIds: [], allEmployees: false, excludedUserIds: [] });
    if (url.includes("/7/participants") || url.includes("/audience/users")) return Response.json(people);
    return Response.json([meeting]);
  }));
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: 2, fullName: "Người tổ chức" } as UserDto, permissions: [] }));
  const screen = await render(<Provider store={store}><MeetingCalendar /></Provider>);
  await userEvent.click(screen.getByText("Họp đối tác · Phòng B", { exact: true }));
  await expect.element(screen.getByRole("img", { name: /^Người tham gia:.*Nguyễn Văn An/ })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Chỉnh sửa cuộc họp", exact: true }));
  await expect.element(screen.getByRole("heading", { name: "Chỉnh sửa cuộc họp" })).toBeVisible();
  await expect.element(screen.getByText("@Nguyễn Văn An", { exact: true })).toBeVisible();
  await expect.element(screen.getByRole("textbox", { name: "Tên cuộc họp*" })).toHaveValue("Họp đối tác");
  await userEvent.fill(screen.getByRole("textbox", { name: "Tên cuộc họp*" }), "Tập huấn mới");
  await userEvent.fill(screen.getByRole("textbox", { name: "Phòng họp / địa điểm*" }), "Phòng C");
  await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi", exact: true }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].method).toBe("PUT");
  expect(writes[0].url).toContain("/api/Meetings/7/booking");
  expect(writes[0].body).toMatchObject({ scope: "Occurrence", expectedVersion: 1, details: { title: "Tập huấn mới", location: "Phòng C", audience: null, participantIds: null, schedule: { startUtc: originalStartUtc, endUtc: originalEndUtc } } });
  await expect.element(screen.getByText("Tập huấn mới · Phòng C", { exact: true })).toBeVisible();
});

/** Mon–Fri 08:00–17:00, Saturday morning, Sunday off. */
const workWeek = { days: [
  { day: "Sunday", start: null, end: null }, ...["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(day => ({ day, start: "08:00", end: "17:00" })),
  { day: "Saturday", start: "08:00", end: "12:00" },
] };
/** The instant of business wall-clock `hour` on the shown week's day `index` (0 = Monday). */
const thisWeekAt = (index: number, hour: number) => {
  const wall = new Date(Date.now() + 7 * 3600000); wall.setUTCHours(hour, 0, 0, 0);
  wall.setUTCDate(wall.getUTCDate() - (wall.getUTCDay() + 6) % 7 + index);
  return new Date(wall.getTime() - 7 * 3600000).toISOString();
};
const calendarFetch = (meetings: unknown[], week: Response | (() => Response) = () => Response.json(workWeek)) =>
  vi.spyOn(window, "fetch").mockImplementation(withRequest(async url => {
    if (url.includes("/Organization/work-week")) return typeof week === "function" ? week() : week;
    if (url.includes("/MeetingKinds")) return Response.json([]);
    if (url.includes("/participants")) return Response.json({ items: [], totalCount: 0, missingEmailCount: 0, pageNumber: 1 });
    return Response.json(meetings);
  }));
const sundayMeeting = () => ({ id: 9, title: "Họp Chủ nhật", kindId: 1, kind: "Nội bộ", location: "501", startUtc: thisWeekAt(6, 10), endUtc: thisWeekAt(6, 11), organizerId: 2, participantCount: 0, isAllDay: false, version: 1 });

test("hours outside work are shaded", async () => {
  const fetches = calendarFetch([]);
  await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await vi.waitFor(() => expect(document.querySelector(".fc-timegrid-col.fc-day-sun .fc-non-business")).not.toBeNull());
  const noon = document.querySelector('.fc-timegrid-slot-lane[data-time="12:00:00"]')!.getBoundingClientRect().top;
  const saturday = [...document.querySelectorAll(".fc-timegrid-col.fc-day-sat .fc-non-business")].map(shade => shade.getBoundingClientRect());
  expect(saturday.some(shade => Math.abs(shade.top - noon) < 1 && shade.height > 0)).toBe(true);
  // Shading the week does not ask for its meetings again.
  await new Promise(resolve => setTimeout(resolve, 300));
  expect(calendarReads(fetches.mock.calls)).toHaveLength(1);
});

test("the range and the layout are chosen apart, and a new range keeps the layout", async () => {
  const fetches = calendarFetch([]);
  const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await vi.waitFor(() => expect(document.querySelector(".fc-timeGridWeek-view")).not.toBeNull());
  expect(screen.getByRole("tab", { name: "Danh sách", exact: true }).query()).toBeNull();
  await expect.element(screen.getByRole("tab", { name: "Dạng lịch" })).toHaveAttribute("aria-selected", "true");
  await userEvent.click(screen.getByRole("tab", { name: "Dạng danh sách" }));
  await vi.waitFor(() => expect(document.querySelector(".fc-listWeek-view")).not.toBeNull());
  await expect.element(screen.getByRole("tab", { name: "Dạng danh sách" })).toHaveAttribute("aria-selected", "true");
  await expect.element(screen.getByRole("tab", { name: "Tuần", exact: true })).toHaveAttribute("aria-selected", "true");
  await userEvent.click(screen.getByRole("tab", { name: "Tháng", exact: true }));
  await vi.waitFor(() => expect(document.querySelector(".fc-listMonth-view")).not.toBeNull());
  const today = new Date(Date.now() + 7 * 3600000);
  // The toolbar names the month (on a desktop the sidebar's month calendar has a heading of its own, for screen readers).
  await expect.element(screen.getByRole("heading", { level: 2, name: `tháng ${today.getUTCMonth() + 1} năm ${today.getUTCFullYear()}`, exact: true })).toBeInTheDocument();
  // A month list reads the whole month, as the sidebar's month calendar does (which read it first, at the start).
  const url = urlOfCall(fetches.mock.calls.filter(call => urlOfCall(call).searchParams.has("FromUtc")).at(-1)!);
  expect(url.searchParams.get("FromUtc")).toBe(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1) - 7 * 3600000).toISOString());
  expect(url.searchParams.get("ToUtc")).toBe(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1) - 7 * 3600000).toISOString());
  await userEvent.click(screen.getByRole("tab", { name: "Ngày", exact: true }));
  await vi.waitFor(() => expect(document.querySelector(".fc-listDay-view")).not.toBeNull());
  await userEvent.click(screen.getByRole("tab", { name: "Dạng lịch" }));
  await vi.waitFor(() => expect(document.querySelector(".fc-timeGridDay-view")).not.toBeNull());
});

test("without a work week the calendar still works", async () => {
  calendarFetch([{ ...sundayMeeting(), title: "Họp thứ Hai", startUtc: thisWeekAt(0, 10), endUtc: thisWeekAt(0, 11) }], () => new Response(null, { status: 500 }));
  const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await expect.element(screen.getByText("Họp thứ Hai · 501", { exact: true })).toBeVisible();
  await new Promise(resolve => setTimeout(resolve, 300));
  expect(document.querySelector(".fc-non-business")).toBeNull();
  await vi.waitFor(() => expect(document.querySelectorAll(".fc-col-header-cell")).toHaveLength(7));
});

test("filters are sent and refetch", async () => {
  const fetches = calendarFetch([]);
  const replace = vi.spyOn(navigation.router, "replace");
  const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await vi.waitFor(() => expect(calendarReads(fetches.mock.calls)).toHaveLength(1));
  expect(urlOfCall(calendarReads(fetches.mock.calls)[0]).searchParams.has("Mine")).toBe(false);
  expect(replace).not.toHaveBeenCalled();
  await userEvent.click(screen.getByText("Tất cả cuộc họp", { exact: true }));
  await userEvent.click(screen.getByRole("option", { name: "Cuộc họp của tôi" }));
  await vi.waitFor(() => expect(calendarReads(fetches.mock.calls)).toHaveLength(2));
  expect(urlOfCall(calendarReads(fetches.mock.calls)[1]).searchParams.get("Mine")).toBe("true");
  expect(replace).toHaveBeenLastCalledWith("/meetings?mine=1", { scroll: false });
});

test("searching never moves the calendar while it reloads", async () => {
  let reads = 0;
  let finish!: () => void;
  vi.spyOn(window, "fetch").mockImplementation(withRequest(async url => {
    if (url.includes("/Organization/work-week")) return Response.json(workWeek);
    if (url.includes("/MeetingKinds")) return Response.json([]);
    if (isMonthRead(new URL(url))) return Response.json([]);
    if (++reads > 1) await new Promise<void>(resolve => { finish = resolve; });
    return Response.json([]);
  }));
  const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  const grid = () => document.querySelector<HTMLElement>(".meeting-grid-scroll")!;
  await vi.waitFor(() => expect(reads).toBe(1));
  await new Promise(resolve => setTimeout(resolve, 300));
  const before = grid().getBoundingClientRect().top;

  await userEvent.type(screen.getByRole("searchbox", { name: "Tìm cuộc họp, phòng, người tổ chức…" }), "401");
  await vi.waitFor(() => expect(reads).toBe(2));
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    expect(grid().getBoundingClientRect().top).toBe(before);
    // Still announced, for screen readers and as a hint, without taking room above the grid.
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải lịch họp…");
  } finally { finish(); }
  await vi.waitFor(() => expect(document.querySelector('[role="status"]')).toBeNull());
  expect(grid().getBoundingClientRect().top).toBe(before);
});

test("the URL keeps view, date and filters", async () => {
  navigation.params = new URLSearchParams("view=dayGridMonth&date=2026-11-03&mine=1");
  const fetches = calendarFetch([]);
  const replace = vi.spyOn(navigation.router, "replace");
  const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await vi.waitFor(() => expect(document.querySelector(".fc-dayGridMonth-view")).not.toBeNull());
  await expect.element(screen.getByRole("heading", { level: 2, name: "tháng 11 năm 2026", exact: true })).toBeInTheDocument();
  await expect.element(screen.getByText("Của tôi", { exact: true })).toBeVisible();
  await vi.waitFor(() => expect(calendarReads(fetches.mock.calls)).toHaveLength(1));
  expect(urlOfCall(calendarReads(fetches.mock.calls)[0]).searchParams.get("Mine")).toBe("true");
  expect(replace).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("tab", { name: "Ngày", exact: true }));
  await vi.waitFor(() => expect(replace).toHaveBeenLastCalledWith("/meetings?view=timeGridDay&date=2026-11-03&mine=1", { scroll: false }));
});

test("on a phone the chosen view is kept in the URL and comes back on reload", async () => {
  await page.viewport(390, 844);
  try {
    calendarFetch([]);
    const replace = vi.spyOn(navigation.router, "replace");
    const first = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
    await vi.waitFor(() => expect(document.querySelector(".fc-dayGridMonth-view")).not.toBeNull());
    await new Promise(resolve => setTimeout(resolve, 300));
    // The phone's own view (month) is not written: the URL stays as it was.
    expect(replace).not.toHaveBeenCalled();
    // The switch picks the range only; the layout (grid or list) has its own button, on a phone too.
    expect(first.getByRole("tab", { name: /Danh sách/ }).query()).toBeNull();
    await expect.element(first.getByRole("button", { name: "Dạng danh sách" })).toBeVisible();
    await userEvent.click(first.getByRole("tab", { name: "Tuần", exact: true }));
    await vi.waitFor(() => expect(replace).toHaveBeenLastCalledWith("/meetings?view=timeGridWeek", { scroll: false }));
    await first.unmount();

    navigation.params = new URLSearchParams("view=timeGridWeek");
    replace.mockClear();
    const reloaded = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
    await vi.waitFor(() => expect(document.querySelector(".fc-timeGridWeek-view")).not.toBeNull());
    await expect.element(reloaded.getByRole("tab", { name: "Tuần", exact: true })).toHaveAttribute("aria-selected", "true");
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(replace).not.toHaveBeenCalled();
  } finally { await page.viewport(1000, 800); }
});

/** The business date (YYYY-MM-DD) of an instant. */
const businessDay = (instant: string) => new Date(Date.parse(instant) + 7 * 3600000).toISOString().slice(0, 10);

test("on a phone a month day shows its meetings as dots, and a tap lists them all", async () => {
  await page.viewport(390, 844);
  try {
    calendarFetch(Array.from({ length: 5 }, (_, i) => ({ ...sundayMeeting(), id: i + 1, title: `Họp số ${i + 1}`, location: "Phòng 501", startUtc: thisWeekAt(2, 8 + i), endUtc: thisWeekAt(2, 9 + i) })));
    const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
    const cell = (date: string) => document.querySelector<HTMLElement>(`.fc-daygrid-day[data-date="${date}"]`)!;
    const day = businessDay(thisWeekAt(2, 8));
    const [year, month, date] = day.split("-");
    const dayHeading = new RegExp(`Cuộc họp ngày .*${date}/${month}/${year}`);
    await vi.waitFor(() => expect(cell(day).querySelectorAll(".meeting-dot")).toHaveLength(3));
    const more = cell(day).querySelector<HTMLElement>(".meeting-more-count")!;
    expect(more.textContent).toBe("+2");
    expect(more.scrollWidth).toBeLessThanOrEqual(more.clientWidth);
    // No title cut to a few letters: the day holds its number and "+2", nothing else.
    expect(cell(day).textContent).not.toContain("Họp");
    const box = cell(day).getBoundingClientRect();
    for (const mark of cell(day).querySelectorAll(".meeting-dot, .meeting-more-count")) {
      const inner = mark.getBoundingClientRect();
      expect(inner.left).toBeGreaterThanOrEqual(box.left);
      expect(inner.right).toBeLessThanOrEqual(box.right);
    }

    // A day without meetings does nothing.
    await userEvent.click(cell(businessDay(thisWeekAt(3, 8))).querySelector(".fc-daygrid-day-top")!);
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    // A tap on the day, outside its dots, lists its meetings.
    await userEvent.click(cell(day).querySelector(".fc-daygrid-day-top")!);
    await expect.element(screen.getByRole("heading", { name: dayHeading })).toBeVisible();
    expect(document.querySelectorAll('[role="dialog"] li')).toHaveLength(5);
    await userEvent.click(screen.getByRole("button", { name: "Đóng" }));
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());

    // So does a tap on a dot; a meeting in the list opens its details.
    await userEvent.click(cell(day).querySelector(".meeting-dot")!);
    await expect.element(screen.getByRole("heading", { name: dayHeading })).toBeVisible();
    expect(document.querySelectorAll('[role="dialog"] li')).toHaveLength(5);
    await userEvent.click(screen.getByRole("button", { name: /Họp số 4/ }));
    await expect.element(screen.getByRole("dialog", { name: "Họp số 4" })).toBeVisible();
    expect(document.body.textContent).toContain("Họp số 4");
  } finally { await page.viewport(1000, 800); }
});

test("on a phone the week fits the screen, with compact cards that open their details", async () => {
  await page.viewport(390, 844);
  try {
    navigation.params = new URLSearchParams("view=timeGridWeek");
    calendarFetch([{ ...sundayMeeting(), title: "Họp tuần", location: "Phòng 501", startUtc: thisWeekAt(0, 10), endUtc: thisWeekAt(0, 11) }]);
    const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
    await vi.waitFor(() => expect(document.querySelector('[data-meeting-id="9"]')).not.toBeNull());
    const scroller = document.querySelector<HTMLElement>(".meeting-grid-scroll")!;
    expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth);
    const card = document.querySelector<HTMLElement>(".meeting-calendar")!.getBoundingClientRect();
    const columns = [...document.querySelectorAll<HTMLElement>(".fc-timegrid-col[data-date]")];
    expect(columns).toHaveLength(7);
    for (const column of columns) {
      const box = column.getBoundingClientRect();
      expect(box.width).toBeGreaterThan(0);
      expect(box.left).toBeGreaterThanOrEqual(card.left);
      expect(box.right).toBeLessThanOrEqual(card.right);
    }
    // Title only: no time line, no place.
    const event = document.querySelector<HTMLElement>('[data-meeting-id="9"]')!;
    expect(event.querySelector(".fc-event-time")).toBeNull();
    expect(event.textContent).toBe("Họp tuần");
    expect(parseFloat(getComputedStyle(event.querySelector(".meeting-compact-title")!).fontSize)).toBeLessThanOrEqual(11);
    await userEvent.click(event);
    await expect.element(screen.getByRole("dialog", { name: "Họp tuần" })).toBeVisible();
  } finally { await page.viewport(1000, 800); }
});

test.each([[390, false], [1000, true]])("at %ipx the page intro is shown: %s", async (width, shown) => {
  await page.viewport(width, 844);
  try {
    calendarFetch([]);
    const screen = await render(<Provider store={makeStore()}><MeetingsPage /></Provider>);
    const heading = screen.getByRole("heading", { level: 1, name: "Lịch họp" });
    await expect.element(heading).toBeInTheDocument();
    // On a phone the app header names the page: the heading is there for screen readers only.
    expect(heading.element().getBoundingClientRect().height > 1).toBe(shown);
    const intro = screen.getByText(/Thêm cuộc họp bằng nút bên dưới/);
    if (shown) await expect.element(intro).toBeVisible();
    else await expect.element(intro).not.toBeVisible();
  } finally { await page.viewport(1000, 800); }
});

test("each meeting is drawn in its own colour: the stripe and the tint", async () => {
  calendarFetch([{ ...sundayMeeting(), startUtc: thisWeekAt(2, 10), endUtc: thisWeekAt(2, 11), color: "#AB3030" }]);
  await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await vi.waitFor(() => expect(document.querySelector('[data-meeting-id="9"]')).not.toBeNull());
  const card = document.querySelector<HTMLElement>('[data-meeting-id="9"]')!;
  expect(card.style.getPropertyValue("--meeting-color")).toBe("#AB3030");
  expect(getComputedStyle(card).borderLeftColor).toBe("rgb(171, 48, 48)");
  expect(card.className).not.toMatch(/meeting-tone/);
});
