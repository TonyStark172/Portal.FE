import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import type { AudienceSelection } from "../meetingTypes";
import { MeetingAudiencePicker } from "./MeetingAudiencePicker";
afterEach(() => vi.restoreAllMocks());

/** The request a mocked fetch received (RTK Query hands fetch a Request). */
const requestOf = (input: RequestInfo | URL, init?: RequestInit) => input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
test("creator can remove their own selected participant chip", async () => {
  mockAudience();
  const screen = await render(<Harness />);
  const remove = screen.getByRole("button", {name:/Bỏ Tổ chức/});
  await expect.element(remove).toBeEnabled();
  await userEvent.click(remove);
  await expect.element(screen.getByRole("status", {name:"Audience source"})).toHaveTextContent('"userIds":[]');
});
function storeFor(permissions: string[]) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  void store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: 1, fullName: "Tổ chức" } as UserDto, permissions }));
  return store;
}
function Harness({initial={userIds:[1],departmentIds:[],allEmployees:false,excludedUserIds:[]},disabled=false,store}:{initial?:AudienceSelection;disabled?:boolean;store?:ReturnType<typeof makeStore>}) {
  const [selection, setSelection] = useState<AudienceSelection>(initial);
  // One store per test: RTK Query keeps what it read, which must not leak from one test into the next.
  const [own] = useState(() => store ?? storeFor([Permissions.Meetings.Broadcast]));
  return <Provider store={own}><div style={{ width: 420, padding: 16 }}><MeetingAudiencePicker disabled={disabled} selection={selection} onChange={setSelection} /><output aria-label="Audience source">{JSON.stringify(selection)}</output></div></Provider>;
}
function mockAudience() {
  const people = [{ userId: 1, fullName: "Tổ chức" }, { userId: 3, fullName: "Nguyễn Văn An", employeeCode: "00003" }, { userId: 4, fullName: "Nguyễn Văn An", employeeCode: "00004" }];
  vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const request = requestOf(input, init);
    const url = request.url;
    if (String(url).includes("/departments")) return Response.json([{ id: 5, name: "Phòng Công Nghệ Thông Tin" }]);
    if (String(url).includes("/preview")) {
      const body = await request.clone().json();
      const covered = body.selection.allEmployees ? people : people.filter(p => p.userId === 3);
      const items = body.candidateIds ? covered.filter(p => body.candidateIds.includes(p.userId)) : covered;
      return Response.json({ items, totalCount: items.length, missingEmailCount: 0, pageNumber: 1 });
    }
    const parsed = new URL(String(url), window.location.origin);
    const ids = parsed.searchParams.get("Ids")?.split(",").map(Number);
    const search = parsed.searchParams.get("Search")?.toLowerCase() ?? "";
    const items = ids ? people.filter(p => ids.includes(p.userId)) : people.filter(p => p.fullName.toLowerCase().includes(search));
    return Response.json({ items, totalCount: items.length, missingEmailCount: 0, pageNumber: 1 });
  });
}
test("leading whitespace before @ still shows people", async () => {
  mockAudience();
  const screen = await render(<Harness />);
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia", exact: true }), " @");
  await expect.element(screen.getByRole("option", { name: /Nguyễn Văn An 00003/ })).toBeVisible();
});

test("plain names do not search employees until an @ prefix is entered", async () => {
  mockAudience();
  const screen = await render(<Harness />);
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia", exact: true }), "Nguyễn Văn An");
  // Observe beyond the 200ms debounce: an immediate assertion can miss an unwanted search.
  await new Promise(resolve => setTimeout(resolve, 350));
  await expect.element(screen.getByRole("combobox", { name: "Người tham gia", exact: true })).toHaveAttribute("aria-expanded", "false");
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia", exact: true }), "");
  await userEvent.type(screen.getByRole("combobox", { name: "Người tham gia", exact: true }), "aaaa");
  await userEvent.click(screen.getByRole("button", { name: "Tìm người tham gia", exact: true }));
  await expect.element(screen.getByRole("combobox", { name: "Người tham gia", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect.element(screen.getByRole("option", { name: /Nguyễn Văn An 00003/ })).not.toBeInTheDocument();
  expect(vi.mocked(window.fetch).mock.calls.some(([url, init]) => requestOf(url, init).url.includes("Search=Nguy"))).toBe(false);
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia", exact: true }), "@Nguyễn Văn An");
  await expect.element(screen.getByRole("option", { name: /Nguyễn Văn An 00003/ })).toBeVisible();
});

test("everyone and person labels share the same leading avatar column", async () => {
  mockAudience();
  await render(<Harness />);
  await userEvent.fill(document.querySelector<HTMLInputElement>('[role="combobox"]')!, "@");
  await expect.poll(() => {
    const everyone = document.querySelector('[role="option"][data-key="all"] label');
    const person = document.querySelector('[role="option"][data-key="user:3"] label');
    return everyone && person ? Math.abs(everyone.getBoundingClientRect().left - person.getBoundingClientRect().left) : Infinity;
  }).toBeLessThan(1);
});

test("leading whitespace before / still finds departments", async () => {
  mockAudience();
  const screen = await render(<Harness />);
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia", exact: true }), " /Công Nghệ");
  await expect.element(screen.getByRole("option", { name: /Phòng Công Nghệ Thông Tin/ })).toBeVisible();
});

test("@all replaces other tags and locks adding people or departments until removed", async () => {
  mockAudience();
  const screen = await render(<Harness />);
  const input = screen.getByRole("combobox", { name: "Người tham gia", exact: true });
  await userEvent.fill(input, "@");
  await userEvent.click(screen.getByRole("option", { name: /Tất cả nhân viên/ }));
  await expect.element(screen.getByLabelText("Audience source")).toHaveTextContent('"allEmployees":true');
  await expect.element(screen.getByText("@Tất cả nhân viên", { exact: true })).toBeVisible();
  await expect.element(input).toBeDisabled();
  await expect.element(screen.getByText("@Tổ chức", { exact: true })).not.toBeInTheDocument();
  await userEvent.click(document.querySelector<HTMLElement>('[data-slot="tag"][data-key="all"] [data-slot="tag-remove-button"]')!);
  await expect.element(input).not.toBeDisabled();
});
test("department tags prune covered individuals and disable only the matching user ID", async () => {
  mockAudience();
  const screen = await render(<Harness />);
  const input = screen.getByRole("combobox", { name: "Người tham gia", exact: true });
  await userEvent.fill(input, "@An");
  await userEvent.click(screen.getByRole("option", { name: /Nguyễn Văn An 00003/ }));
  await expect.element(screen.getByText("@Nguyễn Văn An", { exact: true })).toBeVisible();
  await userEvent.fill(input, "/Công Nghệ");
  await userEvent.click(screen.getByRole("option", { name: /Phòng Công Nghệ Thông Tin/ }));
  await expect.element(screen.getByLabelText("Audience source")).toHaveTextContent('"userIds":[1]');
  await expect.element(screen.getByText("@Nguyễn Văn An", { exact: true })).not.toBeInTheDocument();
  await expect.element(screen.getByText("/Phòng Công Nghệ Thông Tin", { exact: true })).toBeVisible();
  await userEvent.fill(input, "@An");
  await expect.element(screen.getByRole("option", { name: /Nguyễn Văn An 00003/ })).toHaveAttribute("aria-disabled", "true");
  await userEvent.click(screen.getByRole("option", { name: /Nguyễn Văn An 00004/ }));
  await expect.element(screen.getByLabelText("Audience source")).toHaveTextContent('"userIds":[1,4]');
  expect(document.querySelectorAll('[role="grid"]').length).toBe(1);
  await expect.element(screen.getByRole("button", { name: "Xem trước người tham gia" })).not.toBeInTheDocument();
});

test("@all replaces department tags as well as individuals",async()=>{
  mockAudience();
  const screen=await render(<Harness initial={{userIds:[1,4],departmentIds:[5],allEmployees:false,excludedUserIds:[]}}/>);
  const input=screen.getByRole("combobox",{name:"Người tham gia",exact:true});
  await userEvent.fill(input,"@all");
  await userEvent.click(screen.getByRole("option",{name:/Tất cả nhân viên/}));
  await expect.element(screen.getByLabelText("Audience source")).toHaveTextContent('"userIds":[],"departmentIds":[],"allEmployees":true');
  await expect.element(screen.getByText("/Phòng Công Nghệ Thông Tin",{exact:true})).not.toBeInTheDocument();
});

test("failed group membership lookup preserves individual tags and never silently adds a group",async()=>{
  mockAudience();
  const original=vi.mocked(window.fetch).getMockImplementation()!;
  vi.spyOn(window,"fetch").mockImplementation(async(url,init)=>requestOf(url,init).url.includes("/preview") ? Response.json({detail:"Không kiểm tra được thành viên"},{status:503}) : original(url,init));
  const screen=await render(<Harness/>);
  const input=screen.getByRole("combobox",{name:"Người tham gia",exact:true});
  await userEvent.fill(input,"/Công Nghệ");
  await userEvent.click(screen.getByRole("option",{name:/Phòng Công Nghệ Thông Tin/}));
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Vui lòng thử lại");
  await expect.element(screen.getByLabelText("Audience source")).toHaveTextContent('"userIds":[1]');
  await expect.element(screen.getByText("/Phòng Công Nghệ Thông Tin",{exact:true})).not.toBeInTheDocument();
  await expect.element(input).not.toBeDisabled();
});

function mockPagedPeople(loadPage?: (page: number, search: string) => Promise<Response> | Response) {
  mockAudience();
  const original = vi.mocked(window.fetch).getMockImplementation()!;
  vi.spyOn(window, "fetch").mockImplementation(async (url, init) => {
    const parsed = new URL(requestOf(url, init).url);
    if (!parsed.pathname.endsWith("/audience/users") || parsed.searchParams.has("Ids")) return original(url, init);
    const page = Number(parsed.searchParams.get("PageNumber") ?? 1);
    const size = Number(parsed.searchParams.get("PageSize"));
    const search = parsed.searchParams.get("Search") ?? "";
    if (loadPage) return loadPage(page, search);
    const people = Array.from({ length: 65 }, (_, i) => ({ userId: 1001 + i, fullName: `Employee ${String(i + 1).padStart(3, "0")}`, employeeCode: String(1001 + i) }));
    const matches = people.filter(p => p.fullName.includes(search));
    return Response.json({ items: matches.slice((page - 1) * size, page * size), totalCount: matches.length, missingEmailCount: 0, pageNumber: page });
  });
}

function scrollToEnd() {
  const list = document.querySelector<HTMLElement>('[role="listbox"]')!;
  list.scrollTop = list.scrollHeight;
  list.dispatchEvent(new Event("scroll"));
}

test("fixed-height virtualized dropdown loads the next page with skeletons and does not duplicate requests", async () => {
  let resolveNext!: (response: Response) => void;
  let nextCalls = 0;
  const items = (start: number) => Array.from({ length: 30 }, (_, i) => ({ userId: 1000 + start + i, fullName: `Employee ${String(start + i).padStart(3, "0")}` }));
  mockPagedPeople(page => {
    if (page === 1) return Response.json({ items: items(1), totalCount: 60, pageNumber: 1 });
    nextCalls++;
    return new Promise<Response>(resolve => { resolveNext = resolve; });
  });
  const screen = await render(<Harness />);
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia", exact: true }), "@");
  await expect.element(screen.getByRole("option", { name: /Employee 001/ })).toBeVisible();
  const list = document.querySelector<HTMLElement>('[role="listbox"]')!;
  expect(list.getBoundingClientRect().height).toBeLessThanOrEqual(320);
  expect(document.querySelectorAll('[role="option"]').length).toBeLessThan(30);
  const popover = list.closest<HTMLElement>(".meeting-audience-popover")!;
  const outerBounds = popover.getBoundingClientRect();
  const scrollBounds = list.getBoundingClientRect();
  // Native scrollbar buttons must sit inside, not under, the rounded clipping corners.
  expect(scrollBounds.top - outerBounds.top).toBeGreaterThanOrEqual(12);
  expect(outerBounds.bottom - scrollBounds.bottom).toBeGreaterThanOrEqual(12);
  scrollToEnd();
  await expect.element(screen.getByRole("status", { name: "Đang tải nhân viên" })).toBeVisible();
  // CSS visibility alone does not prove that the loading rows are inside the scroll viewport.
  const loadingRows = document.querySelector<HTMLElement>('[role="status"][aria-label="Đang tải nhân viên"]')!;
  await vi.waitFor(() => {
    const viewport = list.getBoundingClientRect();
    const skeleton = loadingRows.getBoundingClientRect();
    expect(Math.min(viewport.bottom, skeleton.bottom) - Math.max(viewport.top, skeleton.top)).toBeGreaterThan(0);
  });
  scrollToEnd();
  expect(nextCalls).toBe(1);
  resolveNext(Response.json({ items: items(31), totalCount: 60, pageNumber: 2 }));
  await expect.element(screen.getByRole("status", { name: "Đang tải nhân viên" })).not.toBeInTheDocument();
  scrollToEnd();
  await expect.element(screen.getByRole("option", { name: /Employee 060/ })).toBeVisible();
  expect(nextCalls).toBe(1);
});

test("failed next page preserves loaded people and retries the same page", async () => {
  let nextCalls = 0;
  mockPagedPeople(page => {
    if (page === 2 && ++nextCalls === 1) return Response.json({}, { status: 503 });
    return Response.json({ items: Array.from({ length: 30 }, (_, i) => ({ userId: 1000 + (page - 1) * 30 + i, fullName: `Employee ${page}-${i}` })), totalCount: 60, pageNumber: page });
  });
  const screen = await render(<Harness />);
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia", exact: true }), "@");
  await expect.element(screen.getByRole("option", { name: /Employee 1-0/ })).toBeVisible();
  scrollToEnd();
  await userEvent.click(screen.getByRole("button", { name: "Thử tải lại" }));
  await expect.poll(() => nextCalls).toBe(2);
  await expect.poll(() => document.querySelector<HTMLElement>('[role="listbox"]')!.scrollHeight).toBeGreaterThan(3000);
  scrollToEnd();
  await expect.element(screen.getByRole("option", { name: /Employee 2-29/ })).toBeVisible();
  expect(nextCalls).toBe(2);
  const list = document.querySelector<HTMLElement>('[role="listbox"]')!;
  list.scrollTop = 0;
  list.dispatchEvent(new Event("scroll"));
  await expect.element(screen.getByRole("option", { name: /Employee 1-0/ })).toBeVisible();
});

test("new search aborts the old request and late results never replace the current list", async () => {
  let resolveOld!: (response: Response) => void;
  let oldSignal: AbortSignal | undefined;
  mockAudience();
  const original = vi.mocked(window.fetch).getMockImplementation()!;
  vi.spyOn(window, "fetch").mockImplementation(async (url, init) => {
    const request = requestOf(url, init);
    const parsed = new URL(request.url);
    if (!parsed.pathname.endsWith("/audience/users") || parsed.searchParams.has("Ids")) return original(url, init);
    if (parsed.searchParams.get("Search") === "Old") {
      oldSignal = request.signal;
      return new Promise<Response>(resolve => { resolveOld = resolve; });
    }
    return Response.json({ items: [{ userId: 7, fullName: "Fresh result" }], totalCount: 1, pageNumber: 1 });
  });
  const screen = await render(<Harness />);
  const input = screen.getByRole("combobox", { name: "Người tham gia", exact: true });
  await userEvent.fill(input, "@Old");
  await expect.poll(() => typeof resolveOld).toBe("function");
  await userEvent.fill(input, "@Fresh");
  await expect.element(screen.getByRole("option", { name: /Fresh result/ })).toBeVisible();
  expect(oldSignal?.aborted).toBe(true);
  resolveOld(Response.json({ items: [{ userId: 8, fullName: "Old result" }], totalCount: 1, pageNumber: 1 }));
  await userEvent.keyboard("{ArrowDown}");
  await expect.element(screen.getByRole("option", { name: /Fresh result/ })).toBeVisible();
  await expect.element(screen.getByRole("option", { name: /Old result/ })).not.toBeInTheDocument();
});

test("search after scrolling starts at page one and discards old pages", async () => {
  const calls: Array<{ page: number; search: string }> = [];
  mockPagedPeople((page, search) => {
    calls.push({ page, search });
    if (search) return Response.json({ items: [{ userId: 99, fullName: "Specific person" }], totalCount: 1, pageNumber: page });
    return Response.json({ items: Array.from({ length: 30 }, (_, i) => ({ userId: 1000 + (page - 1) * 30 + i, fullName: `Employee ${page}-${i}` })), totalCount: 60, pageNumber: page });
  });
  const screen = await render(<Harness />);
  const input = screen.getByRole("combobox", { name: "Người tham gia", exact: true });
  await userEvent.fill(input, "@");
  await expect.element(screen.getByRole("option", { name: /Employee 1-0/ })).toBeVisible();
  scrollToEnd();
  await expect.poll(() => calls.some(call => call.page === 2)).toBe(true);
  await userEvent.fill(input, "@Specific");
  await expect.element(screen.getByRole("option", { name: /Specific person/ })).toBeVisible();
  expect(calls.filter(call => call.search === "Specific")).toEqual([{ page: 1, search: "Specific" }]);
  await expect.element(screen.getByRole("option", { name: /Employee/ })).not.toBeInTheDocument();
});

test("disabling the form invalidates a pending department selection", async () => {
  mockAudience();
  const original = vi.mocked(window.fetch).getMockImplementation()!;
  let resolveMembership!: (response: Response) => void;
  let membershipSignal: AbortSignal | undefined;
  vi.spyOn(window, "fetch").mockImplementation(async (url, init) => {
    const request = requestOf(url, init);
    if (!request.url.includes("/preview")) return original(url, init);
    membershipSignal = request.signal;
    return new Promise<Response>(resolve => { resolveMembership = resolve; });
  });
  const screen = await render(<Harness />);
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia", exact: true }), "/Công Nghệ");
  await userEvent.click(screen.getByRole("option", { name: /Phòng Công Nghệ Thông Tin/ }));
  await expect.element(screen.getByText("Đang kiểm tra thành viên…", { exact: true })).toBeVisible();
  await screen.rerender(<Harness disabled />);
  expect(membershipSignal?.aborted).toBe(true);
  resolveMembership(Response.json({ items: [], totalCount: 0, pageNumber: 1 }));
  await expect.element(screen.getByText("Đang kiểm tra thành viên…", { exact: true })).not.toBeInTheDocument();
  await expect.element(screen.getByLabelText("Audience source")).toHaveTextContent('"userIds":[1]');
  await expect.element(screen.getByText("/Phòng Công Nghệ Thông Tin", { exact: true })).not.toBeInTheDocument();
});

test("everyone is offered only to those allowed to invite the whole company", async () => {
  mockAudience();
  const screen = await render(<Harness store={storeFor([])} />);
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia", exact: true }), "@");
  await expect.element(screen.getByRole("option", { name: /Nguyễn Văn An 00003/ })).toBeVisible();
  expect(document.querySelector('[role="option"][data-key="all"]')).toBeNull();
});

test("after the department list fails, retrying finds departments", async () => {
  let failing = true;
  vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const request = requestOf(input, init);
    if (request.url.includes("/departments")) {
      return failing ? new Response("down", { status: 503 }) : Response.json([{ id: 5, name: "Phòng Công Nghệ Thông Tin" }]);
    }
    return Response.json({ items: [{ userId: 1, fullName: "Tổ chức" }], totalCount: 1, missingEmailCount: 0, pageNumber: 1 });
  });
  const screen = await render(<Harness />);
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia", exact: true }), "/");
  const retry = screen.getByRole("button", { name: "Thử tải lại" });
  await expect.element(retry).toBeVisible();

  failing = false;
  await userEvent.click(retry);

  await expect.element(screen.getByRole("option", { name: /Phòng Công Nghệ Thông Tin/ })).toBeVisible();
});

test("a few suggestions fit the list without empty space below", async () => {
  mockAudience();
  const screen = await render(<Harness />);
  await userEvent.fill(screen.getByRole("combobox", { name: "Người tham gia", exact: true }), "/");
  await expect.element(screen.getByRole("option", { name: /Phòng Công Nghệ Thông Tin/ })).toBeVisible();

  const list = document.querySelector<HTMLElement>('[role="listbox"]')!;
  const option = document.querySelector<HTMLElement>('[role="option"]')!;
  // One department, 56 px per row and 6 px of padding above and below: nothing more.
  expect(list.getBoundingClientRect().height).toBeLessThanOrEqual(option.getBoundingClientRect().height + 12 + 2);
});
