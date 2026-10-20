import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { AppShell } from "@/core/layout/AppShell";
import MeetingsPage from "@/app/(portal)/meetings/page";
import { portalApi, type UserDto } from "@/shared/api/generated/portalApi";
import { signedIn } from "@/shared/session/sessionSlice";
import { MeetingCalendar } from "./MeetingCalendar";

/** The calendar's layout per screen size: phone (portrait and sideways), tablet, desktop. */
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace: () => {}, push: () => {}, prefetch: () => {} }), usePathname: () => "/meetings" }));
afterEach(async () => { vi.restoreAllMocks(); await page.viewport(1000, 800); });

/** Answers every read with nothing; counts the reads of meetings (the ones with a range). */
function emptyCalendar() {
  const reads = { meetings: 0 };
  vi.spyOn(window, "fetch").mockImplementation(async input => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (url.searchParams.has("FromUtc")) reads.meetings++;
    if (url.pathname.includes("/Organization/work-week")) return new Response(null, { status: 404 });
    return Response.json([]);
  });
  return reads;
}
const renderCalendar = () => render(<Provider store={makeStore()}><MeetingCalendar /></Provider>);
/** The meetings page in the real app shell (its header and padding), as a signed-in user sees it. */
async function renderPage() {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: 2, fullName: "Người dùng", roles: [] } as unknown as UserDto, permissions: [] }));
  return render(<Provider store={store}><AppShell defaultCollapsed={false}><MeetingsPage /></AppShell></Provider>);
}
const toolbar = () => document.querySelector<HTMLElement>(".meeting-toolbar")!;
const viewSwitch = () => document.querySelector<HTMLElement>('[role="tablist"]')!;
const fixed = (element: Element) => {
  for (let node: Element | null = element; node; node = node.parentElement) if (getComputedStyle(node).position === "fixed") return true;
  return false;
};
const phoneButtons = ["Khoảng trước", "Khoảng sau", "Hôm nay", "Dạng danh sách", "Bộ lọc", "Thêm cuộc họp"];
/** The controls shown (the tabs' scroll arrows are there only when the tabs overflow). */
const shown = (elements: NodeListOf<Element>) => [...elements].filter(element => element.getBoundingClientRect().width > 0);
/** Every control of the toolbar shares one row, and none spills out of it. */
const expectOneRow = () => {
  const bar = toolbar();
  const title = bar.querySelector("h2")!.getBoundingClientRect();
  for (const control of shown(bar.querySelectorAll("h2, button, [role=tablist]"))) expect(Math.abs(control.getBoundingClientRect().top - title.top)).toBeLessThanOrEqual(4);
  expectNoOverflow(bar);
};
const expectNoOverflow = (bar: HTMLElement) => {
  expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);
  const box = bar.getBoundingClientRect();
  for (const button of shown(bar.querySelectorAll("button"))) {
    const rect = button.getBoundingClientRect();
    expect(rect.left).toBeGreaterThanOrEqual(box.left - 0.5);
    expect(rect.right).toBeLessThanOrEqual(box.right + 0.5);
  }
};

test("on a phone the toolbar is one row of icon buttons after the title", async () => {
  await page.viewport(390, 844);
  emptyCalendar();
  const screen = await renderCalendar();
  await vi.waitFor(() => expect(document.querySelector(".fc-dayGridMonth-view")).not.toBeNull());
  await expect.element(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/^Tháng \d+, \d{4}$/);
  const lefts: number[] = [];
  for (const name of phoneButtons) {
    const button = screen.getByRole("button", { name, exact: true });
    await expect.element(button).toBeVisible();
    const element = button.element();
    // Icons only, each named.
    expect(element.textContent?.trim()).toBe("");
    expect(element.getBoundingClientRect().width).toBeGreaterThanOrEqual(32);
    lefts.push(element.getBoundingClientRect().left);
  }
  expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
  // A tooltip names an icon too (shown on a mouse's hover: React Aria waits for a first pointer use).
  await userEvent.click(screen.getByRole("heading", { level: 2 }));
  await userEvent.hover(screen.getByRole("button", { name: "Hôm nay", exact: true }));
  await expect.element(screen.getByRole("tooltip")).toHaveTextContent("Hôm nay");
  await userEvent.unhover(screen.getByRole("button", { name: "Hôm nay", exact: true }));
  expectOneRow();
  // The view switch is not in the toolbar, and the add button is the last one.
  expect(toolbar().querySelector("[role=tablist]")).toBeNull();
});

test("on a phone the filters button shows how many filters are on", async () => {
  await page.viewport(390, 844);
  emptyCalendar();
  const screen = await renderCalendar();
  await userEvent.click(screen.getByRole("button", { name: "Bộ lọc", exact: true }));
  // A sheet from the bottom: its title, then the search, the kinds and the places.
  const sheet = screen.getByRole("dialog", { name: "Bộ lọc" });
  await expect.element(sheet).toBeVisible();
  await expect.element(sheet.getByRole("searchbox")).toBeVisible();
  // Once it has slid up, it rests on the bottom of the screen.
  await expect.poll(() => Math.abs(sheet.element().getBoundingClientRect().bottom - window.innerHeight)).toBeLessThanOrEqual(1);
  await userEvent.click(sheet.getByText("Tất cả cuộc họp", { exact: true }));
  await userEvent.click(screen.getByRole("option", { name: "Cuộc họp của tôi" }));
  await userEvent.keyboard("{Escape}");
  await expect.element(sheet.getByRole("button", { name: "Xóa lọc (1)" })).toBeVisible();
  await userEvent.keyboard("{Escape}");
  const filters = screen.getByRole("button", { name: "Bộ lọc (1)", exact: true });
  await expect.element(filters).toBeVisible();
  expect(filters.element().textContent?.trim()).toBe("1");
});

test("on a phone the view switch floats at the bottom and changes the view", async () => {
  await page.viewport(390, 844);
  emptyCalendar();
  const screen = await renderCalendar();
  await vi.waitFor(() => expect(document.querySelector(".fc-dayGridMonth-view")).not.toBeNull());
  await expect.element(screen.getByRole("tab", { name: "Tháng", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(fixed(viewSwitch())).toBe(true);
  expect(window.innerHeight - viewSwitch().getBoundingClientRect().bottom).toBeLessThanOrEqual(24);
  expect(window.innerHeight - viewSwitch().getBoundingClientRect().bottom).toBeGreaterThanOrEqual(0);
  await userEvent.click(screen.getByRole("tab", { name: "Tuần", exact: true }));
  await vi.waitFor(() => expect(document.querySelector(".fc-timeGridWeek-view")).not.toBeNull());
});

test("on a phone one button toggles the grid and the list", async () => {
  await page.viewport(390, 844);
  emptyCalendar();
  const screen = await renderCalendar();
  await vi.waitFor(() => expect(document.querySelector(".fc-dayGridMonth-view")).not.toBeNull());
  await userEvent.click(screen.getByRole("button", { name: "Dạng danh sách", exact: true }));
  await vi.waitFor(() => expect(document.querySelector(".fc-listMonth-view")).not.toBeNull());
  expect(screen.getByRole("button", { name: "Dạng danh sách", exact: true }).query()).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Dạng lịch", exact: true }));
  await vi.waitFor(() => expect(document.querySelector(".fc-dayGridMonth-view")).not.toBeNull());
});

test("on a phone the month fills the screen down to the view switch, without page scroll", async () => {
  await page.viewport(390, 844);
  emptyCalendar();
  const screen = await renderPage();
  await vi.waitFor(() => expect(document.querySelectorAll(".fc-dayGridMonth-view .fc-daygrid-body tr").length).toBeGreaterThanOrEqual(5));
  // The page heading is left to the app header: it takes no room.
  expect(screen.getByRole("heading", { level: 1, name: "Lịch họp" }).element().getBoundingClientRect().height).toBeLessThanOrEqual(1);
  await new Promise(resolve => setTimeout(resolve, 200));
  const month = document.querySelector<HTMLElement>(".fc-dayGridMonth-view")!.getBoundingClientRect();
  const switchTop = viewSwitch().getBoundingClientRect().top;
  expect(month.bottom).toBeLessThanOrEqual(switchTop);
  expect(switchTop - month.bottom).toBeLessThanOrEqual(100);
  expect(document.documentElement.scrollHeight - window.innerHeight).toBeLessThanOrEqual(8);
  // No card around it on a phone.
  const card = getComputedStyle(document.querySelector(".meeting-calendar")!);
  expect(card.borderTopWidth).toBe("0px");
  expect(card.boxShadow).toBe("none");
});

test("at 320px nothing spills out of the phone toolbar", async () => {
  await page.viewport(320, 640);
  emptyCalendar();
  await renderCalendar();
  await vi.waitFor(() => expect(document.querySelector(".fc-dayGridMonth-view")).not.toBeNull());
  expectOneRow();
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
});

test("on a tablet the toolbar keeps the tabs and layout buttons, with the filters behind a button", async () => {
  await page.viewport(900, 1000);
  emptyCalendar();
  const screen = await renderCalendar();
  await vi.waitFor(() => expect(document.querySelector(".fc-timeGridWeek-view")).not.toBeNull());
  expect(viewSwitch().querySelectorAll("[role=tab]")).toHaveLength(3);
  expect(fixed(viewSwitch())).toBe(false);
  // Calendar or list: tabs like the range ones.
  await expect.element(screen.getByRole("tab", { name: "Dạng lịch" })).toHaveAttribute("aria-selected", "true");
  await expect.element(screen.getByRole("tab", { name: "Dạng danh sách" })).toHaveAttribute("aria-selected", "false");
  await expect.element(screen.getByRole("button", { name: "Bộ lọc", exact: true })).toBeVisible();
  expect(document.querySelector('[role="searchbox"]')).toBeNull();
  await expect.element(screen.getByRole("button", { name: "Thêm cuộc họp" })).toHaveTextContent("Thêm cuộc họp");
  expectNoOverflow(toolbar());
  for (const row of toolbar().querySelectorAll<HTMLElement>(".meeting-toolbar-row")) expectNoOverflow(row);
});

test.each([[900, 1000], [1024, 768]])("on a %ix%i tablet the filters are a funnel icon right next to the layout buttons", async (width, height) => {
  await page.viewport(width, height);
  emptyCalendar();
  const screen = await renderCalendar();
  await vi.waitFor(() => expect(document.querySelector(".fc-timeGridWeek-view")).not.toBeNull());
  const filters = (await screen.getByRole("button", { name: "Bộ lọc", exact: true }).element()) as HTMLElement;
  // An icon only: no visible word (the name stays for screen readers).
  expect(filters.innerText.trim()).toBe("");
  const layout = document.querySelector<HTMLElement>(".meeting-layout")!.getBoundingClientRect();
  const button = filters.getBoundingClientRect();
  expect(Math.abs(button.top - layout.top)).toBeLessThanOrEqual(4);
  expect(button.left - layout.right).toBeGreaterThanOrEqual(0);
  expect(button.left - layout.right).toBeLessThanOrEqual(12);
});

test("a tablet turned sideways (1024x768) keeps the tablet layout", async () => {
  await page.viewport(1024, 768);
  emptyCalendar();
  const screen = await renderCalendar();
  await vi.waitFor(() => expect(document.querySelector(".fc-timeGridWeek-view")).not.toBeNull());
  // The range tabs and the calendar/list tabs.
  expect(toolbar().querySelectorAll("[role=tab]")).toHaveLength(5);
  expect(fixed(viewSwitch())).toBe(false);
  await expect.element(screen.getByRole("button", { name: "Bộ lọc", exact: true })).toBeVisible();
  expect(document.querySelector('[role="searchbox"]')).toBeNull();
  expectNoOverflow(toolbar());
});

test("a phone turned sideways keeps the phone toolbar, with the view switch in it", async () => {
  await page.viewport(844, 390);
  emptyCalendar();
  await renderPage();
  await vi.waitFor(() => expect(document.querySelector(".fc-dayGridMonth-view")).not.toBeNull());
  expect(toolbar().contains(viewSwitch())).toBe(true);
  expect(fixed(viewSwitch())).toBe(false);
  expect(document.querySelector('[role="searchbox"]')).toBeNull();
  // The menu is a sheet there too: the calendar takes the screen's width, less the page's padding.
  const padding = parseFloat(getComputedStyle(document.querySelector("main")!).paddingLeft);
  expect(document.querySelector(".meeting-calendar")!.getBoundingClientRect().width).toBeGreaterThanOrEqual(window.innerWidth - 2 * padding - 1);
  expectOneRow();
  await new Promise(resolve => setTimeout(resolve, 200));
  expect(document.querySelector<HTMLElement>(".fc-dayGridMonth-view")!.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
  expect(document.documentElement.scrollHeight - window.innerHeight).toBeLessThanOrEqual(8);
});

test("turning the phone moves the view switch into the toolbar and reloads the meetings once", async () => {
  await page.viewport(390, 844);
  const reads = emptyCalendar();
  await renderCalendar();
  await vi.waitFor(() => expect(reads.meetings).toBe(1));
  expect(fixed(viewSwitch())).toBe(true);
  await page.viewport(844, 390);
  await vi.waitFor(() => expect(toolbar().contains(viewSwitch())).toBe(true));
  expect(fixed(viewSwitch())).toBe(false);
  await vi.waitFor(() => expect(reads.meetings).toBe(2));
  await new Promise(resolve => setTimeout(resolve, 300));
  expect(reads.meetings).toBe(2);
});

test.each([[960, 1440], [768, 1024], [1024, 768], [1920, 1080]])("at %ix%i the calendar fills the screen down to the page padding", async (width, height) => {
  await page.viewport(width, height);
  emptyCalendar();
  const screen = await renderPage();
  await vi.waitFor(() => expect(document.querySelector(".fc-timeGridWeek-view")).not.toBeNull());
  await userEvent.click(screen.getByRole("tab", { name: "Tháng", exact: true }));
  await vi.waitFor(() => expect(document.querySelector(".fc-dayGridMonth-view")).not.toBeNull());
  await new Promise(resolve => setTimeout(resolve, 300));
  const card = document.querySelector<HTMLElement>(".meeting-calendar")!.getBoundingClientRect();
  const grid = document.querySelector<HTMLElement>(".fc-scrollgrid")!.getBoundingClientRect();
  // The card ends at the bottom page padding (24 px), not hundreds of pixels above it, and the grid fills the card.
  expect(innerHeight - card.bottom).toBeLessThanOrEqual(32);
  expect(card.bottom - grid.bottom).toBeLessThanOrEqual(32);
  expect(document.documentElement.scrollHeight - innerHeight).toBeLessThanOrEqual(8);
});

test("on a short desktop window the grid keeps a usable height and the page scrolls instead", async () => {
  await page.viewport(1280, 600);
  emptyCalendar();
  await renderPage();
  await vi.waitFor(() => expect(document.querySelector(".fc-timeGridWeek-view")).not.toBeNull());
  await new Promise(resolve => setTimeout(resolve, 300));
  expect(document.querySelector<HTMLElement>(".meeting-grid-scroll")!.getBoundingClientRect().height).toBeGreaterThanOrEqual(400);
});
