import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { MeetingCalendar } from "./MeetingCalendar";
import { page, userEvent } from "vitest/browser";
import { signedIn } from "@/shared/session/sessionSlice";
import { portalApi, type UserDto } from "@/shared/api/generated/portalApi";

afterEach(() => vi.restoreAllMocks());

test("resizing the all-day end handle to 23:00 sends one timed occurrence update", async () => {
  const wallStart = new Date(); wallStart.setUTCHours(0, 0, 0, 0);
  const startUtc = new Date(wallStart.getTime() - 7 * 3600000).toISOString();
  const endUtc = new Date(wallStart.getTime() + 17 * 3600000).toISOString();
  let meeting = { id: 7, title: "Họp cả ngày", kind: "Nội bộ", location: "501", startUtc, endUtc, organizerId: 2, participantIds: [3], isAllDay: true, version: 4 };
  const writes: { scope: string; details: { schedule: { startUtc: string; endUtc: string; isAllDay: boolean }; participantIds: null } }[] = [];
  let finishSave!: () => void;
  const pendingSave = new Promise<void>(resolve => { finishSave = resolve; });
  vi.spyOn(window, "fetch").mockImplementation(async (_url, init) => {
    if (init?.method === "PUT") {
      const request = JSON.parse(String(init.body)); writes.push(request);
      meeting = { ...meeting, ...request.details.schedule, version: 5 };
      await pendingSave;
      return Response.json({ anchorId: 7, affectedCount: 1, version: 5, mutationId: request.details.mutationId });
    }
    return Response.json([meeting]);
  });
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
  expect(writes[0]).toMatchObject({ scope: "occurrence", details: { participantIds: null, schedule: {
    startUtc, endUtc: new Date(wallStart.getTime() + 16 * 3600000).toISOString(), isAllDay: false,
  } } });
  try {
    await vi.waitFor(() => expect(getComputedStyle(document.querySelector<HTMLElement>('[data-meeting-id="7"]')!).pointerEvents).toBe("none"));
  } finally { finishSave(); }
  await vi.waitFor(() => expect(getComputedStyle(document.querySelector<HTMLElement>('[data-meeting-id="7"]')!).pointerEvents).not.toBe("none"));
});

test.each([15, 60])("resize grips never appear, including edge hover, and leave a draggable body for a %i-minute meeting", async minutes => {
  const wallStart = new Date(); wallStart.setUTCHours(10, 0, 0, 0);
  const startUtc = new Date(wallStart.getTime() - 7 * 3600000).toISOString();
  const endUtc = new Date(wallStart.getTime() - 7 * 3600000 + minutes * 60000).toISOString();
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json([
    { id: 7, title: "Họp ngắn", kind: "Nội bộ", location: "501", startUtc, endUtc, organizerId: 2, participantIds: [], isAllDay: false, version: 1 },
  ]));
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
  const wallStart = new Date(); wallStart.setUTCHours(0, 0, 0, 0);
  const startUtc = new Date(wallStart.getTime() - 7 * 3600000).toISOString();
  const endUtc = new Date(wallStart.getTime() + 17 * 3600000).toISOString();
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json([
    { id: 7, title: "Cả ngày thử", kind: "Nội bộ", location: "501", startUtc, endUtc, organizerId: 2, participantIds: [], isAllDay: true, version: 1 },
  ]));
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
    vi.spyOn(window, "fetch").mockImplementation(async () => Response.json([]));
    const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
    await expect.element(screen.getByRole("tab", {name:"Tháng", exact:true})).toHaveAttribute("aria-selected", "true");
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    const tabViewport = document.querySelector(".tabs__list-container")!.getBoundingClientRect();
    for (const tab of document.querySelectorAll(".meeting-toolbar [role=tab]")) {
      expect(tab.getBoundingClientRect().right).toBeLessThanOrEqual(tabViewport.right);
    }
    for (const element of document.querySelectorAll<HTMLElement>(".meeting-toolbar button, .meeting-toolbar [role=tab]")) {
      const box = element.getBoundingClientRect();
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
    }
    await userEvent.click(screen.getByRole("tab", {name:"Tuần", exact:true}));
    const scroller = document.querySelector<HTMLElement>(".meeting-grid-scroll")!;
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    expect(document.querySelector(".fc-timeGridWeek-view")!.getBoundingClientRect().width).toBeGreaterThanOrEqual(800);
    await userEvent.click(screen.getByRole("tab", {name:"Ngày", exact:true}));
    expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth + 1);
  } finally { await page.viewport(1000, 800); }
});

test("keeps the header fixed without an all-day row while the time grid remains scrollable", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json([]));
  await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  const fixedRows = [...document.querySelectorAll<HTMLElement>(".fc-scrollgrid-section-header .fc-scroller, .fc-scrollgrid-section-body:not(.fc-scrollgrid-section-liquid) .fc-scroller")];
  expect(fixedRows.length).toBe(1);
  fixedRows.forEach((row) => expect(getComputedStyle(row).overflowY).toBe("hidden"));
  const grid = document.querySelector<HTMLElement>(".fc-scrollgrid-section-liquid .fc-scroller")!;
  expect(getComputedStyle(grid).overflowY).toBe("scroll");
  expect(grid.scrollHeight).toBeGreaterThan(grid.clientHeight);
});

test.each([900, 320])("keeps the list view label on one line inside a %ipx calendar", async (width) => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json([]));
  await render(<Provider store={makeStore()}><div style={{ width }}><MeetingCalendar /></div></Provider>);
  const tab = document.querySelector<HTMLElement>('[role="tab"][id$="-tab-listWeek"]')!;
  const text = [...tab.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)!;
  const range = document.createRange();
  range.selectNodeContents(text);
  expect(range.getClientRects().length).toBe(1);
  const label = range.getBoundingClientRect();
  const bounds = tab.getBoundingClientRect();
  expect(label.top).toBeGreaterThanOrEqual(bounds.top);
  expect(label.bottom).toBeLessThanOrEqual(bounds.bottom);
});

test("loads only the calendar's visible range, not a second arbitrary fortnight", async () => {
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async () => Response.json([]));
  await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await vi.waitFor(() => expect(fetches).toHaveBeenCalledTimes(1));
  const url = new URL(String(fetches.mock.calls[0][0]), window.location.origin);
  const from = new Date(url.searchParams.get("FromUtc")!);
  const to = new Date(url.searchParams.get("ToUtc")!);
  expect((to.getTime() - from.getTime()) / 86400000).toBe(7);
  expect(document.querySelector('[role="tab"][id$="-tab-timeGridWeek"]')?.getAttribute("aria-selected")).toBe("true");
});

test("shows a load failure on the calendar and lets the user retry", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => new Response("stacktrace", { status: 500 }));
  const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Đã có lỗi xảy ra");
  expect(document.body.textContent).not.toContain("stacktrace");
  await expect.element(screen.getByRole("button", { name: "Thử lại" })).toBeVisible();
});

test("opens meeting details without sending any mutation request", async () => {
  const start = new Date(); start.setHours(10, 0, 0, 0);
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async () => Response.json([
    { id: 7, title: "Họp đối tác", kind: "Đối tác", location: "Phòng B", startUtc: start.toISOString(), endUtc: new Date(start.getTime() + 3600000).toISOString(), organizerId: 2, participantIds: [2, 3] },
  ]));
  const screen = await render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
  await userEvent.click(screen.getByText("Họp đối tác · Phòng B", { exact: true }));
  await expect.element(screen.getByRole("heading", { name: "Chi tiết cuộc họp" })).toBeVisible();
  expect(document.body.textContent).toContain("Đối tác");
  expect(fetches.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
});

test("lets the organizer edit prefilled details and sends PUT, not a second booking", async () => {
  const start = new Date(); start.setHours(10, 0, 45, 123);
  const originalStartUtc = start.toISOString();
  const originalEndUtc = new Date(start.getTime() + 3600000).toISOString();
  let meeting = { id: 7, version:1, isAllDay:false, title: "Họp đối tác", kind: "Đối tác", location: "Phòng B", startUtc: start.toISOString(), endUtc: new Date(start.getTime() + 3600000).toISOString(), organizerId: 2, participantIds: [2, 3] };
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async (_input, init) => {
    if (String(_input).includes("/audience/departments")) return Response.json([]);
    if (String(_input).includes("/audience/users")) {
      return Response.json({items:[{userId:2,fullName:"Người tổ chức"},{userId:3,fullName:"Nguyễn Văn An"}],totalCount:2,missingEmailCount:0,pageNumber:1});
    }
    if (init?.method === "PUT") { const {details} = JSON.parse(String(init.body)); meeting = { ...meeting, ...details, ...details.schedule }; return Response.json({meetingId:7}); }
    return Response.json([meeting]);
  });
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: 2, fullName: "Người tổ chức" } as UserDto, permissions: [] }));
  const screen = await render(<Provider store={store}><MeetingCalendar /></Provider>);
  await userEvent.click(screen.getByText("Họp đối tác · Phòng B", { exact: true }));
  await userEvent.click(screen.getByRole("button", { name: "Chỉnh sửa", exact: true }));
  await expect.element(screen.getByRole("heading", { name: "Chỉnh sửa cuộc họp" })).toBeVisible();
  await expect.element(screen.getByText("@Nguyễn Văn An", { exact: true })).toBeVisible();
  expect(document.body.textContent).not.toContain("ID người tham gia");
  await expect.element(screen.getByRole("textbox", { name: "Tên cuộc họp*" })).toHaveValue("Họp đối tác");
  await userEvent.fill(screen.getByRole("textbox", { name: "Tên cuộc họp*" }), "Tập huấn mới");
  await userEvent.fill(screen.getByRole("textbox", { name: "Phòng họp / địa điểm*" }), "Phòng C");
  await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi", exact: true }));
  await vi.waitFor(() => expect(fetches.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1));
  const [url, init] = fetches.mock.calls.find(([, init]) => init?.method === "PUT")!;
  expect(String(url)).toContain("/api/Meetings/7");
  expect(JSON.parse(String(init?.body))).toMatchObject({scope:"occurrence",expectedVersion:1,details:{ title: "Tập huấn mới", location: "Phòng C", participantIds: null, schedule:{startUtc: originalStartUtc, endUtc: originalEndUtc} }});
  expect(fetches.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  await expect.element(screen.getByText("Tập huấn mới · Phòng C", { exact: true })).toBeVisible();
});
