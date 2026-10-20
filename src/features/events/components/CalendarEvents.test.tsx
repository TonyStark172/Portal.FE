import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { MeetingCalendar } from "@/features/meetings/components/MeetingCalendar";
import { SIDEBAR_COLLAPSED_KEY } from "@/features/meetings/components/MeetingSidebar";
import { portalApi, type UserDto } from "@/shared/api/generated/portalApi";
import { signedIn } from "@/shared/session/sessionSlice";
import type { CompanyEvent, Occasion } from "../eventTypes";

/** The calendar's company events and occasions (public holidays, the company's birthday, birthdays), beside its meetings. */
const navigation = vi.hoisted(() => ({ params: new URLSearchParams(), replace: (() => {}) as (href: string) => void }));
vi.mock("next/navigation", () => ({ useSearchParams: () => navigation.params, useRouter: () => ({ replace: (href: string) => navigation.replace(href) }) }));

/** Business wall-clock `hour` on `day` as an instant (UTC+7). */
const at = (day: string, hour: number, minute = 0) => new Date(Date.parse(`${day}T00:00:00Z`) + ((hour - 7) * 60 + minute) * 60000).toISOString();
const companyEvent = (id: number, title: string, patch: Partial<CompanyEvent>): CompanyEvent => ({
  id, title, description: null, location: null, startUtc: at("2026-10-14", 9), endUtc: at("2026-10-14", 11), isAllDay: false,
  category: "Other", departments: [], createdById: 1, canManage: true, ...patch,
});
// At 10:30 on Wednesday 14 October 2026: the training is on, the toast is over, the deadline is tomorrow all day.
const events = [
  companyEvent(1, "Đào tạo an toàn", { category: "Training" }),
  companyEvent(2, "Hạn nộp báo cáo", { category: "Other", isAllDay: true, startUtc: at("2026-10-15", 0), endUtc: at("2026-10-16", 0) }),
  companyEvent(3, "Chúc mừng sinh nhật công ty", { category: "Party", startUtc: at("2026-10-14", 7), endUtc: at("2026-10-14", 8) }),
  companyEvent(4, "Hội thao", { category: "TeamBuilding", isAllDay: true, startUtc: at("2026-10-22", 0), endUtc: at("2026-10-23", 0) }),
];
const occasions: Occasion[] = [
  { kind: "Birthday", date: "2026-10-14", userId: 9, fullName: "Lê Bình", avatarUrl: null, departmentName: "Kỹ thuật" },
  { kind: "CompanyAnniversary", date: "2026-10-16", years: 5, organizationName: "AnNV" },
  { kind: "Birthday", date: "2026-10-27", userId: 7, fullName: "Phạm Chi", avatarUrl: null, departmentName: null },
  // Tết 2027: Friday 5 February (the lunar new year's eve) through Tuesday 9 February, across a week's end.
  { kind: "Holiday", date: "2027-02-05", endDate: "2027-02-09", holiday: "LunarNewYear" },
  { kind: "Birthday", date: "2027-02-08", userId: 6, fullName: "Đỗ Hà", avatarUrl: null, departmentName: null },
];
const lastDay = (occasion: Occasion) => occasion.kind === "Holiday" ? occasion.endDate : occasion.date;
const meeting = { id: 70, title: "Giao ban", kindId: 1, kind: "Nội bộ", location: "Phòng 501", startUtc: at("2026-10-13", 9), endUtc: at("2026-10-13", 10),
  organizerId: 2, participantCount: 3, status: "Scheduled", color: "#AB3030", isAllDay: false, isException: false, version: 1, seriesSchedule: null };

const urlOf = (input: RequestInfo | URL) => new URL(input instanceof Request ? input.url : String(input), location.href);
const businessDay = (instant: number) => new Date(instant + 7 * 3600000).toISOString().slice(0, 10);
/** Answers meetings, events and occasions in the range asked for; records every read by its path. */
function serve() {
  const reads: URL[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async input => {
    const url = urlOf(input);
    if (url.pathname.includes("/Organization/work-week")) return new Response(null, { status: 404 });
    if (!url.searchParams.has("FromUtc")) return Response.json([]);
    reads.push(url);
    const from = Date.parse(url.searchParams.get("FromUtc")!);
    const to = Date.parse(url.searchParams.get("ToUtc")!);
    if (url.pathname.endsWith("/Events/occasions")) return Response.json(occasions.filter(o => lastDay(o) >= businessDay(from) && o.date < businessDay(to)));
    if (url.pathname.endsWith("/Events")) return Response.json(events.filter(e => Date.parse(e.startUtc) < to && Date.parse(e.endUtc) > from));
    return Response.json([meeting].filter(m => Date.parse(m.startUtc) < to && Date.parse(m.endUtc) > from));
  });
  return reads;
}
async function renderCalendar(permissions: string[] = []) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: 2, fullName: "Người xem" } as UserDto, permissions }));
  return render(<Provider store={store}><MeetingCalendar /></Provider>);
}
const cards = (id: string) => [...document.querySelectorAll<HTMLElement>(`.fc [data-meeting-id="${id}"]`)];
const card = (id: string) => cards(id)[0];

beforeEach(async () => {
  await page.viewport(1280, 800);
  try { localStorage.removeItem(SIDEBAR_COLLAPSED_KEY); } catch { /* none */ }
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date(at("2026-10-14", 10, 30)));
  navigation.params = new URLSearchParams("date=2026-10-14");
  navigation.replace = () => {};
});
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await page.viewport(1000, 800);
});

test("events are drawn by category and state, all-day ones in the all-day row, and none can be dragged", async () => {
  serve();
  await renderCalendar(["Events.Manage"]);
  await vi.waitFor(() => expect(card("event:1")).toBeDefined());
  const training = card("event:1");
  expect(training.classList).toContain("event-training");
  expect(training.classList).toContain("meeting-ongoing");
  expect(training.textContent).toContain("Đang diễn ra");
  expect(training.getAttribute("aria-label")).toContain("(đang diễn ra)");
  expect(card("event:3").classList).toContain("meeting-finished");
  await vi.waitFor(() => expect(card("event:2")).toBeDefined());
  expect(card("event:2").closest(".fc-daygrid-body")).not.toBeNull();
  expect(card("event:2").classList).toContain("event-other");
  // Solid blocks in their category's colour, not a meeting's tinted card with a stripe.
  const style = getComputedStyle(training);
  expect(style.borderLeftWidth).toBe("0px");
  expect(style.backgroundColor).not.toBe(getComputedStyle(card("event:2")).backgroundColor);
  for (const id of ["event:1", "event:2", "event:3"]) {
    expect(card(id).classList.contains("fc-event-draggable"), id).toBe(false);
    expect(card(id).querySelector(".fc-event-resizer"), id).toBeNull();
  }
  // Occasions are lines in the all-day row.
  const birthday = card("occasion:Birthday:9:2026-10-14");
  expect(birthday.textContent).toContain("Sinh nhật Lê Bình");
  expect(birthday.closest(".fc-daygrid-body")).not.toBeNull();
  const companyBirthday = card("occasion:CompanyAnniversary:2026-10-16");
  expect(companyBirthday.textContent).toContain("Sinh nhật AnNV · 5 năm");
  expect(companyBirthday.classList).toContain("occasion-company");
  expect(document.querySelector(".occasion-anniversary")).toBeNull();
});

test("an event opens its details, an occasion its card", async () => {
  serve();
  const screen = await renderCalendar();
  await vi.waitFor(() => expect(card("event:1")).toBeDefined());
  await userEvent.click(card("event:1"));
  const details = screen.getByRole("dialog", { name: "Đào tạo an toàn" });
  await expect.element(details).toBeVisible();
  await expect.element(details.getByText("Đào tạo", { exact: true })).toBeVisible();
  // Without Events.Manage there is nothing to change.
  expect(screen.getByRole("button", { name: "Chỉnh sửa sự kiện" }).query()).toBeNull();
  await userEvent.keyboard("{Escape}");
  await expect.element(details).not.toBeInTheDocument();

  await userEvent.click(card("occasion:Birthday:9:2026-10-14"));
  const occasion = screen.getByRole("dialog", { name: "Lê Bình" });
  await expect.element(occasion).toBeVisible();
  await expect.element(occasion.getByText("Sinh nhật", { exact: true })).toBeVisible();
});

test("with Events.Manage 'Thêm' is a menu of a meeting or an event", async () => {
  serve();
  const screen = await renderCalendar(["Events.Manage"]);
  expect(screen.getByRole("button", { name: "Thêm cuộc họp" }).query()).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Thêm vào lịch" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Sự kiện" }));
  await expect.element(screen.getByRole("dialog", { name: "Thêm sự kiện" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Hủy" }));
  await expect.element(screen.getByRole("dialog", { name: "Thêm sự kiện" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Thêm vào lịch" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Cuộc họp" }));
  await expect.element(screen.getByRole("dialog", { name: "Thêm cuộc họp" })).toBeVisible();
});

test("without Events.Manage 'Thêm cuộc họp' stays a plain button", async () => {
  serve();
  const screen = await renderCalendar();
  await expect.element(screen.getByRole("button", { name: "Thêm cuộc họp" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Thêm vào lịch" }).query()).toBeNull();
});

test("a manager edits an event from its details, and the calendar reads it again after saving", async () => {
  const reads = serve();
  const writes: { method: string; body: unknown }[] = [];
  const served = vi.mocked(window.fetch).getMockImplementation()!;
  vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(urlOf(input), init);
    if (request.method === "PUT") {
      const body = JSON.parse(await request.text());
      writes.push({ method: "PUT", body });
      return Response.json({ ...events[0], ...body });
    }
    return served(input, init);
  });
  const screen = await renderCalendar(["Events.Manage"]);
  await vi.waitFor(() => expect(card("event:1")).toBeDefined());
  await userEvent.click(card("event:1"));
  await userEvent.click(screen.getByRole("button", { name: "Chỉnh sửa sự kiện" }));
  const form = screen.getByRole("dialog", { name: "Chỉnh sửa sự kiện" });
  await expect.element(form).toBeVisible();
  await userEvent.fill(form.getByRole("textbox", { name: "Tên sự kiện" }), "Đào tạo PCCC");
  const before = reads.filter(url => url.pathname.endsWith("/Events")).length;
  await userEvent.click(form.getByRole("button", { name: "Lưu thay đổi" }));
  await expect.element(form).not.toBeInTheDocument();
  expect(writes).toEqual([{ method: "PUT", body: expect.objectContaining({ title: "Đào tạo PCCC", category: "Training", departmentIds: [] }) }]);
  await vi.waitFor(() => expect(reads.filter(url => url.pathname.endsWith("/Events")).length).toBeGreaterThan(before));
});

test("the show filter leaves out events or occasions, and the URL keeps it", async () => {
  const reads = serve();
  const replaced: string[] = [];
  navigation.replace = href => { replaced.push(href); };
  const screen = await renderCalendar();
  await vi.waitFor(() => expect(card("event:1")).toBeDefined());
  await userEvent.click(screen.getByRole("button", { name: /Hiển thị/ }));
  await userEvent.click(screen.getByRole("option", { name: "Sự kiện" }));
  await vi.waitFor(() => expect(card("event:1")).toBeUndefined());
  expect(card("occasion:Birthday:9:2026-10-14")).toBeDefined();
  expect(card("70")).toBeDefined();
  await vi.waitFor(() => expect(replaced.at(-1)).toContain("show=meetings&show=occasions"));
  // What is not shown is not asked for.
  const eventReads = reads.filter(url => url.pathname.endsWith("/Events")).length;
  await userEvent.click(screen.getByRole("option", { name: "Ngày lễ & sinh nhật" }));
  await vi.waitFor(() => expect(card("occasion:Birthday:9:2026-10-14")).toBeUndefined());
  expect(reads.filter(url => url.pathname.endsWith("/Events")).length).toBe(eventReads);
  await vi.waitFor(() => expect(replaced.at(-1)).toContain("show=meetings"));
});

test("a link that shows meetings only asks for nothing else", async () => {
  navigation.params = new URLSearchParams("date=2026-10-14&show=meetings");
  const reads = serve();
  await renderCalendar();
  await vi.waitFor(() => expect(card("70")).toBeDefined());
  await new Promise(resolve => setTimeout(resolve, 300));
  expect(reads.filter(url => url.pathname.includes("/Events"))).toHaveLength(0);
  expect(card("event:1")).toBeUndefined();
});

test("the sidebar lists the week's events and occasions under its meetings; a row opens it", async () => {
  serve();
  const screen = await renderCalendar();
  const section = screen.getByRole("region", { name: "Sự kiện & dịp" });
  await expect.element(section).toBeVisible();
  await vi.waitFor(() => expect(section.element().querySelectorAll("li")).toHaveLength(5));
  expect(section.element().textContent).toContain("Đào tạo an toàn");
  expect(section.element().textContent).toContain("Sinh nhật Lê Bình");
  // The month and the meetings come first (the lists scroll under the month, which stays put).
  const lists = document.querySelector(".meeting-sidebar .meeting-sidebar-scroll")!;
  expect(lists.lastElementChild).toBe(section.element());
  // Over: struck through, as a meeting.
  const toast = section.element().querySelector<HTMLElement>('[data-event-key="event:3"]')!;
  expect(toast.classList).toContain("meeting-finished");
  await userEvent.click(section.getByRole("button", { name: /Hạn nộp báo cáo/ }));
  await expect.element(screen.getByRole("dialog", { name: "Hạn nộp báo cáo" })).toBeVisible();
});

test("the sidebar's month marks the days of events and occasions too", async () => {
  serve();
  await renderCalendar();
  const day = (date: number) => [...document.querySelectorAll<HTMLElement>(".meeting-sidebar .calendar__cell")]
    .find(cell => cell.getAttribute("data-outside-month") !== "true" && cell.textContent?.trim() === String(date))!;
  // The 22nd (an event) and the 27th (a birthday) are outside the week shown.
  await vi.waitFor(() => expect(day(27).querySelector(".calendar__cell-indicator")).not.toBeNull());
  expect(day(22).querySelector(".calendar__cell-indicator")).not.toBeNull();
  expect(day(13).querySelector(".calendar__cell-indicator")).not.toBeNull();
  expect(day(20).querySelector(".calendar__cell-indicator")).toBeNull();
});

test.each([320, 390])("on a %ipx phone a month day's dots count events and occasions, and a tap lists them", async width => {
  await page.viewport(width, 844);
  navigation.params = new URLSearchParams("date=2026-10-14");
  serve();
  const screen = await renderCalendar();
  const cell = (date: string) => document.querySelector<HTMLElement>(`.fc-daygrid-day[data-date="${date}"]`)!;
  await vi.waitFor(() => expect(cell("2026-10-14").querySelectorAll(".meeting-dot")).toHaveLength(3));
  expect(cell("2026-10-15").querySelectorAll(".meeting-dot")).toHaveLength(1);
  expect(cell("2026-10-27").querySelectorAll(".meeting-dot")).toHaveLength(1);
  const box = cell("2026-10-14").getBoundingClientRect();
  for (const mark of cell("2026-10-14").querySelectorAll(".meeting-dot, .meeting-more-count")) {
    const inner = mark.getBoundingClientRect();
    expect(inner.left).toBeGreaterThanOrEqual(box.left);
    expect(inner.right).toBeLessThanOrEqual(box.right);
  }
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
  await userEvent.click(cell("2026-10-14").querySelector(".fc-daygrid-day-top")!);
  const day = screen.getByRole("dialog", { name: /Lịch ngày/ });
  await expect.element(day).toBeVisible();
  expect(day.element().textContent).toContain("Đào tạo an toàn");
  expect(day.element().textContent).toContain("Chúc mừng sinh nhật công ty");
  expect(day.element().textContent).toContain("Sinh nhật Lê Bình");
  await userEvent.click(day.getByRole("button", { name: /Sinh nhật Lê Bình/ }));
  await expect.element(screen.getByRole("dialog", { name: "Lê Bình" })).toBeVisible();
});

const tet = "occasion:Holiday:LunarNewYear:2027-02-05";

test("a holiday is a bar over its days in a month, broken where a week ends, and opens its card", async () => {
  navigation.params = new URLSearchParams("date=2027-02-05&view=dayGridMonth");
  serve();
  const screen = await renderCalendar();
  await vi.waitFor(() => expect(cards(tet)).toHaveLength(2));
  const [friday, monday] = cards(tet);
  expect(friday.textContent).toContain("Tết Nguyên đán");
  expect(friday.classList).toContain("occasion-holiday");
  expect(friday.querySelector(".occasion-icon")).not.toBeNull();
  // Friday to Sunday, then Monday and Tuesday on the next week's row.
  const row = (el: HTMLElement) => el.closest("tr")!;
  expect(row(friday)).not.toBe(row(monday));
  const width = (el: HTMLElement) => el.getBoundingClientRect().width;
  const day = document.querySelector<HTMLElement>('.fc-daygrid-day[data-date="2027-02-05"]')!.getBoundingClientRect().width;
  expect(width(friday)).toBeGreaterThan(day * 2.5);
  expect(width(monday)).toBeGreaterThan(day * 1.5);
  expect(width(monday)).toBeLessThan(day * 2.5);
  // A soft red wash, unlike a birthday's.
  const birthday = card("occasion:Birthday:6:2027-02-08");
  expect(getComputedStyle(friday).backgroundColor).not.toBe(getComputedStyle(birthday).backgroundColor);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(1280);
  await userEvent.click(monday);
  const dialog = screen.getByRole("dialog", { name: "Tết Nguyên đán" });
  await expect.element(dialog).toBeVisible();
  await expect.element(dialog.getByText("Ngày nghỉ lễ", { exact: true })).toBeVisible();
});

test("the sidebar lists a holiday once for all its days, and the month marks each of them", async () => {
  navigation.params = new URLSearchParams("date=2027-02-08");
  serve();
  const screen = await renderCalendar();
  const section = screen.getByRole("region", { name: "Sự kiện & dịp" });
  await vi.waitFor(() => expect(section.element().querySelectorAll("li")).toHaveLength(2));
  const rows = [...section.element().querySelectorAll("li")].map(li => li.textContent);
  expect(rows[0]).toContain("Tết Nguyên đán");
  expect(rows[0]).toMatch(/05.02 – 09.02/);
  expect(rows[1]).toContain("Sinh nhật Đỗ Hà");
  const cell = (date: number) => [...document.querySelectorAll<HTMLElement>(".meeting-sidebar .calendar__cell")]
    .find(c => c.getAttribute("data-outside-month") !== "true" && c.textContent?.trim() === String(date))!;
  await vi.waitFor(() => expect(cell(9).querySelector(".calendar__cell-indicator")).not.toBeNull());
  for (const date of [5, 6, 7]) expect(cell(date).querySelector(".calendar__cell-indicator"), String(date)).not.toBeNull();
  expect(cell(10).querySelector(".calendar__cell-indicator")).toBeNull();
  await userEvent.click(section.getByRole("button", { name: /Tết Nguyên đán/ }));
  await expect.element(screen.getByRole("dialog", { name: "Tết Nguyên đán" })).toBeVisible();
});

test("a holiday under way keeps its tone without a 'live' tag", async () => {
  vi.setSystemTime(new Date(at("2027-02-08", 10)));
  navigation.params = new URLSearchParams("date=2027-02-08");
  serve();
  await renderCalendar();
  await vi.waitFor(() => expect(card(tet)).toBeDefined());
  expect(card(tet).classList).toContain("occasion-ongoing");
  expect(card(tet).textContent).not.toContain("Đang");
  expect(card(tet).querySelector(".meeting-live-tag, .meeting-live-dot")).toBeNull();
  expect(card(tet).getAttribute("aria-label")).not.toContain("(");
  // The deeper tone of a holiday under way.
  const birthday = card("occasion:Birthday:6:2027-02-08");
  expect(getComputedStyle(card(tet)).backgroundColor).not.toBe(getComputedStyle(birthday).backgroundColor);
});

test("on a phone a holiday puts a dot of its tone on each of its days", async () => {
  await page.viewport(390, 844);
  navigation.params = new URLSearchParams("date=2027-02-05");
  serve();
  await renderCalendar();
  const cell = (date: string) => document.querySelector<HTMLElement>(`.fc-daygrid-day[data-date="${date}"]`)!;
  await vi.waitFor(() => expect(cell("2027-02-09").querySelectorAll(".occasion-holiday .meeting-dot")).toHaveLength(1));
  for (const date of ["2027-02-05", "2027-02-06", "2027-02-07", "2027-02-08"]) expect(cell(date).querySelectorAll(".occasion-holiday .meeting-dot"), date).toHaveLength(1);
  expect(cell("2027-02-10").querySelectorAll(".occasion-holiday")).toHaveLength(0);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
});

test.each(["light", "dark"])("each category has its own colour on the %s theme", theme => {
  document.documentElement.dataset.theme = theme;
  try {
    const colours = ["party", "sports", "teambuilding", "training", "other"].map(category => {
      const swatch = document.createElement("span");
      swatch.className = `event-swatch event-${category}`;
      document.body.append(swatch);
      const colour = getComputedStyle(swatch).backgroundColor;
      swatch.remove();
      return colour;
    });
    expect(colours.every(colour => colour && colour !== "rgba(0, 0, 0, 0)")).toBe(true);
    expect(new Set(colours).size).toBe(5);
  } finally { delete document.documentElement.dataset.theme; }
});
