import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { noFilters, type MeetingFilters } from "../meetingFilters";
import type { MeetingKindDto } from "../meetingTypes";
import { MeetingFilterBar } from "./MeetingFilterBar";

afterEach(() => vi.restoreAllMocks());

const kinds = [
  { id: 1, name: "Nội bộ", isActive: true },
  { id: 2, name: "Đối tác", isActive: true },
  { id: 5, name: "Tập huấn", isActive: false },
] as MeetingKindDto[];
const locations = [{ key: "PHÒNG 503, TẦNG 2", name: "Phòng 503, tầng 2", count: 4 }, { key: "HỘI TRƯỜNG", name: "Hội trường", count: 2 }];
const requestOf = (input: RequestInfo | URL, init?: RequestInit) => input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
const mockLocations = () => vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
  const search = new URL(requestOf(input, init).url).searchParams.get("search")?.toLowerCase() ?? "";
  return Response.json(locations.filter(place => place.name.toLowerCase().includes(search)));
});

/** The bar as the calendar uses it: what it reports becomes its filters. */
function Harness({ initial = noFilters, onChange, compact, sheet }: { initial?: MeetingFilters; onChange: (filters: MeetingFilters) => void; compact?: boolean; sheet?: boolean }) {
  const [filters, setFilters] = useState(initial);
  const [store] = useState(makeStore);
  return (
    <Provider store={store}>
      <MeetingFilterBar filters={filters} kinds={kinds} variant={sheet ? "sheet" : compact ? "popover" : "inline"} onChange={next => { onChange(next); setFilters(next); }} />
    </Provider>
  );
}

test("typing a search reports it once, after a pause", async () => {
  mockLocations();
  const onChange = vi.fn();
  const screen = await render(<Harness onChange={onChange} />);
  const search = screen.getByRole("searchbox", { name: "Tìm cuộc họp, phòng, người tổ chức…" });
  // The debounce clock is faked: on a busy machine two real fills can be more than 300 ms apart.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await userEvent.fill(search, "gi");
    await userEvent.fill(search, "giao");
    vi.advanceTimersByTime(299);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ ...noFilters, search: "giao" });
    vi.advanceTimersByTime(1000);
    expect(onChange).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});

test("'Cuộc họp của tôi' is chosen in the kinds list, with no separate switch", async () => {
  mockLocations();
  const onChange = vi.fn();
  const screen = await render(<Harness onChange={onChange} />);
  expect(document.querySelector('[role="switch"]')).toBeNull();
  await userEvent.click(screen.getByText("Tất cả cuộc họp", { exact: true }));
  await userEvent.click(screen.getByRole("option", { name: "Cuộc họp của tôi" }));
  expect(onChange).toHaveBeenLastCalledWith({ ...noFilters, mine: true });
  await userEvent.click(screen.getByRole("option", { name: "Nội bộ" }));
  expect(onChange).toHaveBeenLastCalledWith({ ...noFilters, mine: true, kindIds: [1] });
  await expect.element(screen.getByText("Của tôi +1")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("option", { name: "Cuộc họp của tôi" }));
  expect(onChange).toHaveBeenLastCalledWith({ ...noFilters, kindIds: [1] });
});

test("several kinds can be chosen, hidden ones too, labelled", async () => {
  mockLocations();
  const onChange = vi.fn();
  const screen = await render(<Harness onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: /Loại/ }));
  await expect.element(screen.getByRole("option", { name: "Tập huấn (đã ẩn)" })).toBeVisible();
  await userEvent.click(screen.getByRole("option", { name: "Nội bộ" }));
  await userEvent.click(screen.getByRole("option", { name: "Tập huấn (đã ẩn)" }));
  expect(onChange).toHaveBeenLastCalledWith({ ...noFilters, kindIds: [1, 5] });
});

test("places are searched on the server and chosen by their key", async () => {
  const fetches = mockLocations();
  const onChange = vi.fn();
  const screen = await render(<Harness onChange={onChange} />);
  const searched = (text: string) => fetches.mock.calls.some(([input, init]) => new URL(requestOf(input, init).url).searchParams.get("search") === text);
  await userEvent.click(screen.getByText("Tất cả địa điểm", { exact: true }));
  await expect.element(screen.getByRole("option", { name: "Hội trường" })).toBeVisible();
  await userEvent.type(screen.getByRole("searchbox", { name: "Tìm địa điểm" }), "503");
  await vi.waitFor(() => expect(searched("503")).toBe(true));
  await expect.element(screen.getByRole("option", { name: "Hội trường" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("option", { name: "Phòng 503, tầng 2" }));
  expect(onChange).toHaveBeenLastCalledWith({ ...noFilters, locations: ["PHÒNG 503, TẦNG 2"] });
  // A place chosen earlier stays chosen while a search lists others.
  await userEvent.fill(screen.getByRole("searchbox", { name: "Tìm địa điểm" }), "hội");
  await vi.waitFor(() => expect(searched("hội")).toBe(true));
  await expect.element(screen.getByRole("option", { name: "Phòng 503, tầng 2" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("option", { name: "Hội trường" }));
  expect(onChange).toHaveBeenLastCalledWith({ ...noFilters, locations: ["PHÒNG 503, TẦNG 2", "HỘI TRƯỜNG"] });
});

test("'Xóa lọc (3)' clears every filter", async () => {
  mockLocations();
  const onChange = vi.fn();
  const screen = await render(<Harness initial={{ ...noFilters, search: "giao", mine: true, kindIds: [2] }} onChange={onChange} />);
  await expect.element(screen.getByRole("searchbox", { name: "Tìm cuộc họp, phòng, người tổ chức…" })).toHaveValue("giao");
  await userEvent.click(screen.getByRole("button", { name: "Xóa lọc (3)" }));
  expect(onChange).toHaveBeenLastCalledWith(noFilters);
  await expect.element(screen.getByRole("searchbox", { name: "Tìm cuộc họp, phòng, người tổ chức…" })).toHaveValue("");
  await expect.element(screen.getByRole("button", { name: /Xóa lọc/ })).not.toBeInTheDocument();
});

test("on a narrow screen the filters open from 'Bộ lọc (n)'", async () => {
  mockLocations();
  const onChange = vi.fn();
  const screen = await render(<Harness compact initial={{ ...noFilters, mine: true }} onChange={onChange} />);
  expect(document.querySelector('[role="switch"]')).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Bộ lọc (1)" }));
  await userEvent.click(screen.getByText("Của tôi", { exact: true }));
  await userEvent.click(screen.getByRole("option", { name: "Cuộc họp của tôi" }));
  expect(onChange).toHaveBeenLastCalledWith(noFilters);
  await expect.element(screen.getByRole("button", { name: "Bộ lọc", exact: true })).toBeVisible();
});

/** Whether an element's content stays inside it (nothing spills over its neighbours). */
const fitsInside = (element: Element, box: Element) => {
  const inner = element.getBoundingClientRect();
  const outer = box.getBoundingClientRect();
  return inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5;
};

test("many chosen places read as the first one and how many more, inside their box", async () => {
  mockLocations();
  const many = ["501", "1001", "1003", "2", "A", "1", "1002", "504", "503", "5"];
  const screen = await render(<div style={{ width: 1100 }}><Harness initial={{ ...noFilters, locations: many }} onChange={() => {}} /></div>);
  const trigger = document.querySelector<HTMLElement>(".autocomplete__trigger")!;
  await expect.element(screen.getByText("501 +9")).toBeVisible();
  const value = trigger.querySelector(".autocomplete__value")!;
  expect(fitsInside(value, trigger)).toBe(true);
  expect(trigger.querySelector("[title]")?.getAttribute("title")).toContain("501, 1001, 1003");
});

test("several chosen kinds read as the first one and how many more", async () => {
  mockLocations();
  const screen = await render(<div style={{ width: 1100 }}><Harness initial={{ ...noFilters, kindIds: [1, 2, 5] }} onChange={() => {}} /></div>);
  await expect.element(screen.getByText("Nội bộ +2")).toBeVisible();
});

test("the search box shows its whole hint", async () => {
  mockLocations();
  const screen = await render(<div style={{ width: 1100 }}><Harness onChange={() => {}} /></div>);
  const input = (await screen.getByRole("searchbox").element()) as HTMLInputElement;
  const style = getComputedStyle(input);
  const context = document.createElement("canvas").getContext("2d")!;
  context.font = style.font;
  const room = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  expect(context.measureText(input.placeholder).width).toBeLessThanOrEqual(room);
});

test("on a phone the filter sheet's search box shows its whole hint", async () => {
  mockLocations();
  await page.viewport(390, 844);
  try {
    const screen = await render(<Harness sheet onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Bộ lọc" }));
    const input = (await screen.getByRole("searchbox").element()) as HTMLInputElement;
    const style = getComputedStyle(input);
    const context = document.createElement("canvas").getContext("2d")!;
    context.font = style.font;
    const room = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    expect(context.measureText(input.placeholder).width).toBeLessThanOrEqual(room);
    // Phones show inputs at 16 px in the app font (Inter, not loaded here): the short hint is the one that fits there.
    expect(input.placeholder).toBe("Tìm cuộc họp, phòng, người…");
    expect(screen.getByRole("searchbox", { name: "Tìm cuộc họp, phòng, người tổ chức…" }).query()).not.toBeNull();
  } finally { await page.viewport(1280, 800); }
});

test.each([[390, 844], [1024, 768]])("at %ix%i the filter count is a coloured badge on the funnel's corner", async (width, height) => {
  mockLocations();
  await page.viewport(width, height);
  try {
    const screen = await render(<Harness compact={width > 767} sheet={width <= 767} initial={{ ...noFilters, mine: true }} onChange={() => {}} />);
    const button = (await screen.getByRole("button", { name: "Bộ lọc (1)" }).element()) as HTMLElement;
    const badge = button.querySelector<HTMLElement>(".meeting-filter-badge")!;
    const style = getComputedStyle(badge);
    expect(style.position).toBe("absolute");
    expect(style.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(style.color).not.toBe(getComputedStyle(button).color);
  } finally { await page.viewport(1280, 800); }
});

test.each(["inline", "popover", "sheet"] as const)("in the %s filters, what is shown can leave out events or occasions, never everything", async variant => {
  mockLocations();
  const onChange = vi.fn();
  const screen = await render(<Harness compact={variant === "popover"} sheet={variant === "sheet"} onChange={onChange} />);
  if (variant !== "inline") await userEvent.click(screen.getByRole("button", { name: "Bộ lọc" }));
  await userEvent.click(screen.getByText("Tất cả mục", { exact: true }));
  await userEvent.click(screen.getByRole("option", { name: "Sự kiện" }));
  expect(onChange).toHaveBeenLastCalledWith({ ...noFilters, show: { meetings: true, events: false, occasions: true } });
  await userEvent.click(screen.getByRole("option", { name: "Cuộc họp" }));
  await userEvent.click(screen.getByRole("option", { name: "Sinh nhật & kỷ niệm" }));
  expect(onChange).toHaveBeenLastCalledWith({ ...noFilters, show: { meetings: false, events: false, occasions: true } });
  expect(onChange).toHaveBeenCalledTimes(2);
  // Not showing everything counts as one filter on.
  await userEvent.keyboard("{Escape}");
  if (variant !== "inline") await expect.element(screen.getByRole("button", { name: "Bộ lọc (1)" })).toBeInTheDocument();
  else await expect.element(screen.getByRole("button", { name: "Xóa lọc (1)" })).toBeInTheDocument();
});
