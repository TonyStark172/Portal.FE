import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { Toast, toast } from "@heroui/react";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { AdminLayout } from "../AdminLayout";
import { portalApi, type PermissionGroupDto, type RoleDto, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { runUnlessBlocked } from "@/shared/lib/navigationGuard";
import { RolesAdmin } from "./RolesAdmin";

const { push, navigation } = vi.hoisted(() => ({ push: vi.fn(), navigation: { params: new URLSearchParams() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push }),
  usePathname: () => "/admin/roles",
  useSearchParams: () => navigation.params,
}));

/** The test page's own address: the page writes `?role=` into it, which must not leak into the next test. */
const startUrl = location.pathname + location.search;
afterEach(() => {
  vi.restoreAllMocks();
  toast.clear();
  navigation.params = new URLSearchParams();
  history.replaceState(history.state, "", startUrl);
});

/** Hands a mocked fetch what RTK Query sent (it passes a Request). */
const withRequest = (handler: (url: string, init: { method: string; body: string | null }) => Promise<Response> | Response) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    return handler(request.url, { method: request.method, body: ["GET", "HEAD"].includes(request.method) ? null : await request.clone().text() });
  };

const groups: PermissionGroupDto[] = [
  { group: "Users", permissions: ["Users.View", "Users.Create", "Users.Update"] },
  { group: "Posts", permissions: ["Posts.Create", "Posts.Manage"] },
];
const everything = groups.flatMap(g => g.permissions);
const roles: RoleDto[] = [
  // Deliberately not in display order: the page puts the administrator first, then the default role, then the rest by name.
  { id: 3, name: "Kế toán", description: null, isAdmin: false, isDefault: false, permissions: ["Users.View", "Posts.Create"], userCount: 2 },
  { id: 4, name: "Biên tập", description: null, isAdmin: false, isDefault: false, permissions: [], userCount: 0 },
  { id: 2, name: "Nhân viên", description: "Vai trò mặc định", isAdmin: false, isDefault: true, permissions: ["Users.View"], userCount: 5 },
  { id: 1, name: "Administrator", description: null, isAdmin: true, isDefault: false, permissions: everything, userCount: 1 },
];

type Write = { method: string; path: string; body: unknown };
/**
 * A back end in a closure: answers the roles (kept up to date by every write that `reply` accepts, so a refetch after a
 * save sees it) and the permissions, and each write with `reply` (no content by default). Returns what was requested:
 * the writes (path with its query string) and every API path read or written.
 */
function mockRoles(reply: (write: Write) => Response | Promise<Response> = () => new Response(null, { status: 204 }), list: RoleDto[] = roles) {
  let current = list;
  let nextId = 10;
  let readGate: Promise<void> | null = null;
  const writes: Write[] = [];
  const requested: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withRequest(async (url, init) => {
    // The API path, without the prefix the app reaches the back end through.
    const { pathname, search } = new URL(url);
    const path = pathname.replace(/^.*?(?=\/api\/)/, "");
    requested.push(path);
    if (path === "/api/Permissions") return Response.json(groups);
    if (path === "/api/Roles" && init.method === "GET") {
      await readGate;
      return Response.json(current);
    }
    if (path.startsWith("/api/Roles")) {
      const write = { method: init.method, path: path + search, body: init.body ? JSON.parse(init.body) : null };
      writes.push(write);
      const response = await reply(write);
      if (response.status < 400) {
        const id = Number(path.split("/")[3]);
        const body = write.body as Partial<RoleDto> | null;
        if (write.method === "POST") current = [...current, { ...(body as RoleDto), id: nextId++, isAdmin: false, isDefault: false, userCount: 0 }];
        else if (write.method === "PUT") current = current.map(role => (role.id === id ? { ...role, ...body } : role));
        else if (write.method === "DELETE") current = current.filter(role => role.id !== id);
      }
      return response;
    }
    return Response.json({});
  }));
  return {
    writes,
    requested,
    /** Changes what the server has behind the page's back (another administrator's save). */
    setServer: (next: RoleDto[]) => { current = next; },
    /** Holds the answers to reads of the roles until the returned function is called. */
    holdReads: () => {
      let release!: () => void;
      readGate = new Promise<void>(resolve => { release = resolve; });
      return release;
    },
  };
}

/** The store of the page being rendered, to make the page read again (as a refocus or another save would). */
let activeStore: ReturnType<typeof makeStore>;
const refetchRoles = () => activeStore.dispatch(portalApi.util.invalidateTags(["Roles"]));

const navigate = vi.fn();

function Harness({ isAdministrator = true, layout = false }: { isAdministrator?: boolean; layout?: boolean }) {
  // One store per test: RTK Query keeps what it read, which must not leak from one test into the next.
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 1, fullName: "An", isAdministrator } as UserDto,
      permissions: [Permissions.Users.View],
    }));
    activeStore = own;
    return own;
  });
  return <Provider store={store}><Toast.Provider />{layout ? <AdminLayout><RolesAdmin /></AdminLayout> : <><a href="/admin/users">Người dùng</a><button type="button" onClick={() => runUnlessBlocked(navigate)}>Đăng xuất</button><RolesAdmin /></>}</Provider>;
}

type Screen = Awaited<ReturnType<typeof render>>;
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The box of a permission (by its plain name) of the role shown. Its name gains "(chưa lưu)" while it has an unsaved change. */
const box = (screen: Screen, permission: string) =>
  screen.getByRole("checkbox", { name: new RegExp(`^${escaped(permission)}( \\(chưa lưu\\))?$`) });
/** The row of a permission: the whole of it is the box's target. */
const row = (screen: Screen, permission: string) => box(screen, permission).element().closest<HTMLElement>("[data-permission]")!;
/** Whether the row of a permission is marked as changed (an unsaved draft). */
const isMarked = (screen: Screen, permission: string) => row(screen, permission).hasAttribute("data-changed");
/** Ticks or unticks a permission by pressing its row (once the page shows it). */
async function tick(screen: Screen, permission: string) {
  await expect.element(box(screen, permission)).toBeInTheDocument();
  await userEvent.click(page.elementLocator(row(screen, permission)));
}

/** The list of roles on the left. */
const roleList = (screen: Screen) => screen.getByRole("list", { name: "Danh sách vai trò" });
/** A role's entry in the list: its name, then its marks and how many people hold it. */
const roleItem = (screen: Screen, name: string) =>
  roleList(screen).getByRole("button", { name: new RegExp(`^${escaped(name)} (Luôn có mọi quyền )?(Mặc định )?\\d+ người`) });
/** The heading of the role shown on the right. */
const shown = (screen: Screen) => screen.getByRole("heading", { level: 3 });
const selectAll = (screen: Screen, group: string) => screen.getByRole("checkbox", { name: `Chọn tất cả quyền ${group}`, exact: true });
const saveButton = (screen: Screen) => screen.getByRole("button", { name: "Lưu thay đổi", exact: true });
const resetButton = (screen: Screen) => screen.getByRole("button", { name: "Đặt lại", exact: true });

/** Opens the "⋯" menu of the role shown and returns the menu. */
async function openMenu(screen: Screen, role: string) {
  await userEvent.click(screen.getByRole("button", { name: `Tuỳ chọn vai trò ${role}`, exact: true }));
  return screen.getByRole("menu");
}

/** Shows another role (nothing unsaved: no question). */
async function show(screen: Screen, role: string) {
  await userEvent.click(roleItem(screen, role));
  await expect.element(shown(screen)).toHaveTextContent(role);
}

/** A PUT / DELETE that stays unanswered until `release()`, so the page can be looked at while the request is on its way. */
function gated() {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  return { release, reply: async () => { await gate; return new Response(null, { status: 204 }); } };
}

const roleInUrl = () => new URLSearchParams(location.search).get("role");

test("not the administrator: no roles page", async () => {
  const { requested } = mockRoles();
  const screen = await render(<Harness isAdministrator={false} />);
  await expect.element(screen.getByText("Bạn không có quyền xem mục quản trị.")).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Vai trò & quyền" })).not.toBeInTheDocument();
  expect(requested.filter(path => path.startsWith("/api/Roles") || path.startsWith("/api/Permissions"))).toEqual([]);
});

test("the list: administrator, the default role, then the rest by name, each with its marks and people; the default role is shown first", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("heading", { name: "Vai trò & quyền" })).toBeVisible();
  await expect.element(screen.getByText("Quyền của một người là tổng quyền từ các vai trò của họ. Bấm Lưu thay đổi để áp dụng.")).toBeVisible();
  await expect.element(roleItem(screen, "Administrator")).toBeVisible();
  const items = roleList(screen).getByRole("button").all().map(item => item.element().textContent);
  expect(items).toEqual(["Administrator1 người", "Nhân viênMặc định5 người", "Biên tập0 người", "Kế toán2 người"]);
  await expect.element(roleItem(screen, "Administrator").getByRole("img", { name: "Luôn có mọi quyền" })).toBeInTheDocument();

  await expect.element(roleItem(screen, "Nhân viên")).toHaveAttribute("aria-current", "true");
  await expect.element(roleItem(screen, "Kế toán")).not.toHaveAttribute("aria-current");
  await expect.element(shown(screen)).toHaveTextContent("Nhân viên");
  const header = screen.getByRole("region", { name: "Nhân viên" });
  await expect.element(header.getByText("Mặc định", { exact: true })).toBeVisible();
  await expect.element(header.getByText("5 người")).toBeVisible();
  await expect.element(header.getByText("Vai trò mặc định", { exact: true })).toBeVisible();
  // "Tạo vai trò" sits at the end of the list.
  await expect.element(screen.getByRole("button", { name: "Tạo vai trò" })).toBeVisible();
});

test("the search filters the list by name", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await userEvent.fill(screen.getByRole("searchbox", { name: "Tìm vai trò" }), "kế");
  await expect.element(roleItem(screen, "Nhân viên")).not.toBeInTheDocument();
  await expect.element(roleItem(screen, "Kế toán")).toBeVisible();
  expect(roleList(screen).getByRole("button").all()).toHaveLength(1);
  // Diacritics need not be typed.
  await userEvent.fill(screen.getByRole("searchbox", { name: "Tìm vai trò" }), "nhan vien");
  await expect.element(roleItem(screen, "Nhân viên")).toBeVisible();
  await userEvent.fill(screen.getByRole("searchbox", { name: "Tìm vai trò" }), "zzz");
  await expect.element(screen.getByText("Không có vai trò nào khớp.")).toBeVisible();
  // The role shown stays shown while the search hides it from the list.
  await expect.element(shown(screen)).toHaveTextContent("Nhân viên");
});

test("?role= selects that role, and the address follows the selection", async () => {
  navigation.params = new URLSearchParams("role=3");
  mockRoles();
  const screen = await render(<Harness />);
  await expect.element(shown(screen)).toHaveTextContent("Kế toán");
  await expect.element(roleItem(screen, "Kế toán")).toHaveAttribute("aria-current", "true");
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
  await show(screen, "Administrator");
  await vi.waitFor(() => expect(roleInUrl()).toBe("1"));
});

test("an id in ?role= that does not exist falls back to the default role", async () => {
  navigation.params = new URLSearchParams("role=999");
  mockRoles();
  const screen = await render(<Harness />);
  await expect.element(shown(screen)).toHaveTextContent("Nhân viên");
  await vi.waitFor(() => expect(roleInUrl()).toBe("2"));
});

test("the permissions: grouped by module in catalogue order, each a box with its name and its description linked", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await expect.element(box(screen, "Xem người dùng")).toBeChecked();
  const sections = [...document.querySelectorAll("section[data-group]")];
  expect(sections.map(section => ({
    group: section.querySelector("h4")?.textContent,
    permissions: [...section.querySelectorAll("[data-permission] [data-slot='permission-label']")].map(label => label.textContent),
  }))).toEqual([
    { group: "Người dùng", permissions: ["Xem người dùng", "Tạo người dùng", "Sửa người dùng"] },
    { group: "Bài viết", permissions: ["Đăng bài", "Quản lý bài viết"] },
  ]);
  await expect.element(box(screen, "Đăng bài")).not.toBeChecked();
  await expect.element(box(screen, "Xem người dùng")).toHaveAccessibleDescription("Xem danh sách và thông tin tài khoản của mọi người.");
  await expect.element(screen.getByText("Xem danh sách và thông tin tài khoản của mọi người.")).toBeVisible();
});

test("the checkboxes, labels and group headers line up: one column for the boxes, one left edge for the text", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await expect.element(box(screen, "Xem người dùng")).toBeVisible();
  const controls = [...document.querySelectorAll<HTMLElement>("[data-permission] [data-slot='checkbox-control']")].map(control => control.getBoundingClientRect().left);
  const labels = [...document.querySelectorAll<HTMLElement>("[data-permission] [data-slot='permission-label']")].map(label => label.getBoundingClientRect().left);
  const headers = [...document.querySelectorAll<HTMLElement>("section[data-group] h4")].map(header => header.getBoundingClientRect().left);
  expect(new Set(controls).size).toBe(1);
  expect(new Set(labels).size).toBe(1);
  // The group names start where the boxes do.
  expect(new Set([...headers, controls[0]]).size).toBe(1);
});

test("ticking only changes the draft: the row is marked (not by colour alone), the footer counts it, Lưu and Đặt lại wake", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await expect.element(saveButton(screen)).toBeDisabled();
  await expect.element(resetButton(screen)).toBeDisabled();
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();

  await tick(screen, "Đăng bài");
  await tick(screen, "Xem người dùng");
  await expect.element(screen.getByRole("checkbox", { name: "Đăng bài (chưa lưu)", exact: true })).toBeChecked();
  await expect.element(screen.getByRole("checkbox", { name: "Xem người dùng (chưa lưu)", exact: true })).not.toBeChecked();
  await expect.element(screen.getByText("2 thay đổi chưa lưu")).toBeVisible();
  await expect.element(saveButton(screen)).toBeEnabled();
  await expect.element(resetButton(screen)).toBeEnabled();
  expect(isMarked(screen, "Đăng bài")).toBe(true);
  expect(isMarked(screen, "Tạo người dùng")).toBe(false);
  // A cue that is not a colour: a word on the row, and a bar at its start.
  expect(row(screen, "Đăng bài").textContent).toContain("Chưa lưu");
  expect(row(screen, "Tạo người dùng").textContent).not.toContain("Chưa lưu");
  expect(getComputedStyle(row(screen, "Đăng bài")).boxShadow).not.toBe("none");
  expect(getComputedStyle(row(screen, "Tạo người dùng")).boxShadow).toBe("none");
  // The list says which role has unsaved changes.
  await expect.element(roleItem(screen, "Nhân viên")).toHaveTextContent("chưa lưu");
  expect(writes).toEqual([]);

  // Putting a box back as it was is no change.
  await tick(screen, "Đăng bài");
  await expect.element(screen.getByText("1 thay đổi chưa lưu")).toBeVisible();
  await expect.element(screen.getByRole("checkbox", { name: "Đăng bài", exact: true })).not.toBeChecked();
  expect(writes).toEqual([]);
});

test("the whole row is the target: at least 44px high, and a press at its far end toggles", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await expect.element(box(screen, "Đăng bài")).toBeVisible();
  const target = row(screen, "Đăng bài").querySelector<HTMLElement>("[data-slot='checkbox-content']")!;
  const bounds = target.getBoundingClientRect();
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(bounds.width - row(screen, "Đăng bài").getBoundingClientRect().width)).toBeLessThan(2);
  await userEvent.click(page.elementLocator(target), { position: { x: bounds.width - 6, y: bounds.height / 2 } });
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
});

test("Lưu sends one PUT of the role with its full new set, name and description unchanged, and says so", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  await tick(screen, "Tạo người dùng");
  await userEvent.click(saveButton(screen));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "PUT", path: "/api/Roles/2", body: { name: "Nhân viên", description: "Vai trò mặc định", permissions: ["Users.View", "Users.Create", "Posts.Create"] } },
  ]));
  await expect.element(screen.getByText("Đã lưu quyền của Nhân viên")).toBeVisible();
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  await expect.element(saveButton(screen)).toBeDisabled();
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
  expect(isMarked(screen, "Đăng bài")).toBe(false);
  expect(writes).toHaveLength(1);
});

test("a refused save keeps the draft and says why, with the role's name", async () => {
  const { writes } = mockRoles(() => Response.json({ status: 403, code: "forbidden", detail: "Bạn không được sửa vai trò này." }, { status: 403 }));
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  await userEvent.click(saveButton(screen));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  await expect.element(screen.getByText("Nhân viên: Bạn không được sửa vai trò này.")).toBeVisible();
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
  expect(isMarked(screen, "Đăng bài")).toBe(true);
  await expect.element(screen.getByText("1 thay đổi chưa lưu")).toBeVisible();
  await expect.element(saveButton(screen)).toBeEnabled();
});

test("\"Chọn tất cả\" of a group ticks or unticks the whole group, and is partly ticked when the group is", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  // "Nhân viên" holds one of the three user permissions, and none of the post ones.
  await expect.element(selectAll(screen, "Người dùng")).toBePartiallyChecked();
  await expect.element(selectAll(screen, "Bài viết")).not.toBeChecked();
  await expect.element(selectAll(screen, "Bài viết")).not.toBePartiallyChecked();

  await userEvent.click(selectAll(screen, "Người dùng"), { force: true });
  for (const permission of ["Xem người dùng", "Tạo người dùng", "Sửa người dùng"]) await expect.element(box(screen, permission)).toBeChecked();
  await expect.element(selectAll(screen, "Người dùng")).toBeChecked();
  await expect.element(screen.getByText("2 thay đổi chưa lưu")).toBeVisible();

  await userEvent.click(selectAll(screen, "Người dùng"), { force: true });
  for (const permission of ["Xem người dùng", "Tạo người dùng", "Sửa người dùng"]) await expect.element(box(screen, permission)).not.toBeChecked();
  await expect.element(selectAll(screen, "Người dùng")).not.toBeChecked();
  await expect.element(screen.getByText("1 thay đổi chưa lưu")).toBeVisible();

  await userEvent.click(selectAll(screen, "Bài viết"), { force: true });
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
  await expect.element(box(screen, "Quản lý bài viết")).toBeChecked();
  expect(writes).toEqual([]);
});

test("Đặt lại puts this role back as saved; disabled with nothing to reset", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await expect.element(resetButton(screen)).toBeDisabled();
  await tick(screen, "Đăng bài");
  await tick(screen, "Xem người dùng");
  await userEvent.click(resetButton(screen));
  await expect.element(box(screen, "Đăng bài")).not.toBeChecked();
  await expect.element(box(screen, "Xem người dùng")).toBeChecked();
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  await expect.element(saveButton(screen)).toBeDisabled();
  await expect.element(resetButton(screen)).toBeDisabled();
  expect(writes).toEqual([]);
});

test("after a save, Đặt lại undoes only the ticks made since", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  await userEvent.click(saveButton(screen));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  await tick(screen, "Quản lý bài viết");
  await userEvent.click(resetButton(screen));
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
  await expect.element(box(screen, "Quản lý bài viết")).not.toBeChecked();
  expect(writes).toHaveLength(1);
});

test("resetting a few changes asks nothing; five or more ask first", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  const four = ["Tạo người dùng", "Sửa người dùng", "Đăng bài", "Quản lý bài viết"];
  for (const permission of four) await tick(screen, permission);
  await expect.element(screen.getByText("4 thay đổi chưa lưu")).toBeVisible();
  await userEvent.click(resetButton(screen));
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();

  for (const permission of four) await tick(screen, permission);
  await tick(screen, "Xem người dùng");
  await expect.element(screen.getByText("5 thay đổi chưa lưu")).toBeVisible();
  await userEvent.click(resetButton(screen));
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog).toHaveTextContent("Bỏ 5 thay đổi chưa lưu?");
  await userEvent.click(dialog.getByRole("button", { name: "Giữ lại" }));
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  await expect.element(screen.getByText("5 thay đổi chưa lưu")).toBeVisible();

  await userEvent.click(resetButton(screen));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Đặt lại" }));
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  await expect.element(box(screen, "Xem người dùng")).toBeChecked();
  expect(writes).toEqual([]);
});

test("switching roles with nothing unsaved asks nothing", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await expect.element(shown(screen)).toHaveTextContent("Nhân viên");
  await show(screen, "Kế toán");
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
  await expect.element(roleItem(screen, "Kế toán")).toHaveAttribute("aria-current", "true");
});

test("switching roles with unsaved changes asks: \"Ở lại\" stays with the draft", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  await userEvent.click(roleItem(screen, "Kế toán"));
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog).toHaveTextContent("Lưu thay đổi của Nhân viên?");
  await userEvent.click(dialog.getByRole("button", { name: "Ở lại" }));
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  await expect.element(shown(screen)).toHaveTextContent("Nhân viên");
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
  await expect.element(screen.getByText("1 thay đổi chưa lưu")).toBeVisible();
  expect(writes).toEqual([]);
});

test("switching roles with unsaved changes: \"Bỏ thay đổi\" drops them and switches (and the address follows)", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  await userEvent.click(roleItem(screen, "Kế toán"));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Bỏ thay đổi" }));
  await expect.element(shown(screen)).toHaveTextContent("Kế toán");
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  // The guard steps back from its history entry once nothing is unsaved; the address must still name the new role.
  await new Promise(resolve => setTimeout(resolve, 300));
  expect(roleInUrl()).toBe("3");
  await show(screen, "Nhân viên");
  await expect.element(box(screen, "Đăng bài")).not.toBeChecked();
  expect(writes).toEqual([]);
});

test("switching roles with unsaved changes: \"Lưu\" saves them, then switches", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  await userEvent.click(roleItem(screen, "Kế toán"));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Lưu", exact: true }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "PUT", path: "/api/Roles/2", body: { name: "Nhân viên", description: "Vai trò mặc định", permissions: ["Users.View", "Posts.Create"] } },
  ]));
  await expect.element(shown(screen)).toHaveTextContent("Kế toán");
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  await expect.element(screen.getByText("Đã lưu quyền của Nhân viên")).toBeVisible();
  await show(screen, "Nhân viên");
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
});

test("switching roles: when \"Lưu\" is refused it stays on the role, draft kept", async () => {
  mockRoles(() => Response.json({ status: 409, code: "conflict", detail: "Đã có thay đổi khác." }, { status: 409 }));
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  await userEvent.click(roleItem(screen, "Kế toán"));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Lưu", exact: true }));
  await expect.element(screen.getByText("Nhân viên: Đã có thay đổi khác.")).toBeVisible();
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  await expect.element(shown(screen)).toHaveTextContent("Nhân viên");
  await expect.element(screen.getByText("1 thay đổi chưa lưu")).toBeVisible();
});

test("the administrator: a note, every box ticked and fixed, no footer and no menu", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await show(screen, "Administrator");
  await expect.element(screen.getByText("Quản trị viên luôn có mọi quyền.")).toBeVisible();
  for (const permission of ["Xem người dùng", "Sửa người dùng", "Đăng bài", "Quản lý bài viết"]) {
    await expect.element(box(screen, permission)).toBeChecked();
    await expect.element(box(screen, permission)).toBeDisabled();
  }
  await expect.element(selectAll(screen, "Người dùng")).toBeDisabled();
  await expect.element(saveButton(screen)).not.toBeInTheDocument();
  await expect.element(resetButton(screen)).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Tuỳ chọn vai trò Administrator", exact: true })).not.toBeInTheDocument();
});

test("creating a role posts its name and description with no permissions, and shows it", async () => {
  const { writes } = mockRoles(() => Response.json(10, { status: 201 }));
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: "Tạo vai trò" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên vai trò" }), "Nhân sự");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Mô tả" }), "Phòng nhân sự");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "POST", path: "/api/Roles", body: { name: "Nhân sự", description: "Phòng nhân sự", permissions: [] } },
  ]));
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  await expect.element(shown(screen)).toHaveTextContent("Nhân sự");
  await expect.element(roleItem(screen, "Nhân sự")).toHaveAttribute("aria-current", "true");
  await expect.element(box(screen, "Đăng bài")).not.toBeChecked();
  await vi.waitFor(() => expect(roleInUrl()).toBe("10"));
});

test("a name another role has is refused under the field", async () => {
  mockRoles(() => Response.json({
    status: 400, code: "validation_failed", detail: "Vui lòng kiểm tra lại các trường được báo lỗi.", errors: { Name: ["Đã có vai trò này."] },
  }, { status: 400 }));
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: "Tạo vai trò" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên vai trò" }), "Kế toán");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await expect.element(dialog).toHaveTextContent("Đã có vai trò này.");
  await expect.element(dialog.getByRole("textbox", { name: "Tên vai trò" })).toHaveValue("Kế toán");
});

test("renaming puts the new name with the role's SAVED permissions and keeps the draft, which then saves under the new name", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  const menu = await openMenu(screen, "Nhân viên");
  await userEvent.click(menu.getByRole("menuitem", { name: "Đổi tên" }));
  const dialog = screen.getByRole("dialog");
  await expect.element(dialog.getByRole("textbox", { name: "Tên vai trò" })).toHaveValue("Nhân viên");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên vai trò" }), "Nhân viên chính thức");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "PUT", path: "/api/Roles/2", body: { name: "Nhân viên chính thức", description: "Vai trò mặc định", permissions: ["Users.View"] } },
  ]));
  await expect.element(shown(screen)).toHaveTextContent("Nhân viên chính thức");
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
  expect(isMarked(screen, "Đăng bài")).toBe(true);
  await userEvent.click(saveButton(screen));
  await vi.waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[1]).toEqual({
    method: "PUT", path: "/api/Roles/2",
    body: { name: "Nhân viên chính thức", description: "Vai trò mặc định", permissions: ["Users.View", "Posts.Create"] },
  });
});

test("duplicating creates \"<name> (bản sao)\" with the saved permissions and description, and shows the copy", async () => {
  const { writes } = mockRoles(() => Response.json(10, { status: 201 }));
  const screen = await render(<Harness />);
  const menu = await openMenu(screen, "Nhân viên");
  await userEvent.click(menu.getByRole("menuitem", { name: "Nhân bản" }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "POST", path: "/api/Roles", body: { name: "Nhân viên (bản sao)", description: "Vai trò mặc định", permissions: ["Users.View"] } },
  ]));
  await expect.element(shown(screen)).toHaveTextContent("Nhân viên (bản sao)");
  await expect.element(box(screen, "Xem người dùng")).toBeChecked();
});

test("duplicating a role with unsaved ticks copies what is SAVED and stays on the role with its draft", async () => {
  const { writes } = mockRoles(() => Response.json(10, { status: 201 }));
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  const menu = await openMenu(screen, "Nhân viên");
  await userEvent.click(menu.getByRole("menuitem", { name: "Nhân bản" }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "POST", path: "/api/Roles", body: { name: "Nhân viên (bản sao)", description: "Vai trò mặc định", permissions: ["Users.View"] } },
  ]));
  await expect.element(roleItem(screen, "Nhân viên (bản sao)")).toBeVisible();
  await expect.element(shown(screen)).toHaveTextContent("Nhân viên");
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
  await expect.element(screen.getByText("1 thay đổi chưa lưu")).toBeVisible();
});

test("a copy of a role whose name is taken gets a number", async () => {
  const taken = [...roles, { id: 5, name: "Nhân viên (bản sao)", description: null, isAdmin: false, isDefault: false, permissions: [], userCount: 0 }];
  const { writes } = mockRoles(() => Response.json(10, { status: 201 }), taken);
  const screen = await render(<Harness />);
  const menu = await openMenu(screen, "Nhân viên");
  await userEvent.click(menu.getByRole("menuitem", { name: "Nhân bản" }));
  await vi.waitFor(() => expect(writes.map(write => (write.body as { name: string }).name)).toEqual(["Nhân viên (bản sao) 2"]));
});

test("deleting a role people hold asks which role they move to, then the default role is shown", async () => {
  navigation.params = new URLSearchParams("role=3");
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  const menu = await openMenu(screen, "Kế toán");
  await userEvent.click(menu.getByRole("menuitem", { name: "Xoá" }));
  const dialog = screen.getByRole("dialog");
  await expect.element(dialog).toHaveTextContent("2 người đang có vai trò này sẽ được chuyển sang:");
  await expect.element(dialog.getByRole("button", { name: /Nhân viên/ })).toBeVisible();
  await userEvent.click(dialog.getByRole("button", { name: "Xoá", exact: true }));
  await vi.waitFor(() => expect(writes).toEqual([{ method: "DELETE", path: "/api/Roles/3?replacementRoleId=2", body: null }]));
  await expect.element(roleItem(screen, "Kế toán")).not.toBeInTheDocument();
  await expect.element(shown(screen)).toHaveTextContent("Nhân viên");
  await vi.waitFor(() => expect(roleInUrl()).toBe("2"));
});

test("deleting a role nobody holds only asks to confirm", async () => {
  navigation.params = new URLSearchParams("role=4");
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  const menu = await openMenu(screen, "Biên tập");
  await userEvent.click(menu.getByRole("menuitem", { name: "Xoá" }));
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog).toHaveTextContent("Vai trò này chưa có ai giữ.");
  await userEvent.click(dialog.getByRole("button", { name: "Xoá", exact: true }));
  await vi.waitFor(() => expect(writes).toEqual([{ method: "DELETE", path: "/api/Roles/4", body: null }]));
});

test("deleting a role that has unsaved ticks drops them: nothing is left to save", async () => {
  navigation.params = new URLSearchParams("role=3");
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await tick(screen, "Tạo người dùng");
  await expect.element(screen.getByText("1 thay đổi chưa lưu")).toBeVisible();
  const menu = await openMenu(screen, "Kế toán");
  await userEvent.click(menu.getByRole("menuitem", { name: "Xoá" }));
  await userEvent.click(screen.getByRole("dialog").getByRole("button", { name: "Xoá", exact: true }));
  await vi.waitFor(() => expect(writes).toEqual([{ method: "DELETE", path: "/api/Roles/3?replacementRoleId=2", body: null }]));
  await expect.element(shown(screen)).toHaveTextContent("Nhân viên");
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  const unload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(false);
});

test("the default role has no \"Xoá\"", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  const menu = await openMenu(screen, "Nhân viên");
  await expect.element(menu.getByRole("menuitem", { name: "Đổi tên" })).toBeVisible();
  await expect.element(menu.getByRole("menuitem", { name: "Nhân bản" })).toBeVisible();
  await expect.element(menu.getByRole("menuitem", { name: "Xoá" })).not.toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  expect(writes).toEqual([]);
});

test("while a delete of a role people hold is on its way, nothing can dismiss the question", async () => {
  navigation.params = new URLSearchParams("role=3");
  const { release, reply } = gated();
  const { writes } = mockRoles(reply);
  const screen = await render(<Harness />);
  const menu = await openMenu(screen, "Kế toán");
  await userEvent.click(menu.getByRole("menuitem", { name: "Xoá" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.click(dialog.getByRole("button", { name: "Xoá", exact: true }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  await expect.element(dialog.getByRole("button", { name: "Huỷ" })).toBeDisabled();
  await expect.element(dialog.getByRole("button", { name: "Đóng" })).toBeDisabled();
  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByRole("dialog")).toBeVisible();
  release();
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
});

test("a refusal to delete is shown in the dialog", async () => {
  navigation.params = new URLSearchParams("role=3");
  mockRoles(() => Response.json({ status: 409, code: "conflict", detail: "Vai trò thay thế không hợp lệ." }, { status: 409 }));
  const screen = await render(<Harness />);
  const menu = await openMenu(screen, "Kế toán");
  await userEvent.click(menu.getByRole("menuitem", { name: "Xoá" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.click(dialog.getByRole("button", { name: "Xoá", exact: true }));
  await expect.element(dialog.getByRole("alert")).toHaveTextContent("Vai trò thay thế không hợp lệ.");
});

test("a list read again composes with the user's ticks: another administrator's change shows, only the user's own is sent", async () => {
  const { writes, setServer } = mockRoles();
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  // Another administrator gives "Nhân viên" the permission to create users, and the page reads the roles again.
  setServer(roles.map(role => (role.id === 2 ? { ...role, permissions: ["Users.View", "Users.Create"] } : role)));
  void refetchRoles();
  await expect.element(box(screen, "Tạo người dùng")).toBeChecked();
  expect(isMarked(screen, "Tạo người dùng")).toBe(false);
  expect(isMarked(screen, "Đăng bài")).toBe(true);
  await expect.element(screen.getByText("1 thay đổi chưa lưu")).toBeVisible();
  await userEvent.click(saveButton(screen));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "PUT", path: "/api/Roles/2", body: { name: "Nhân viên", description: "Vai trò mặc định", permissions: ["Users.View", "Users.Create", "Posts.Create"] } },
  ]));
});

test("a tick the server comes to agree with is no change any more", async () => {
  const { writes, setServer } = mockRoles();
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  await expect.element(screen.getByText("1 thay đổi chưa lưu")).toBeVisible();
  setServer(roles.map(role => (role.id === 2 ? { ...role, permissions: ["Users.View", "Posts.Create"] } : role)));
  void refetchRoles();
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
  expect(isMarked(screen, "Đăng bài")).toBe(false);
  expect(writes).toEqual([]);
});

test("right after a save the boxes keep the saved state until the roles are read again (no jump back)", async () => {
  const { writes, holdReads } = mockRoles();
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  const release = holdReads();
  await userEvent.click(saveButton(screen));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  await expect.element(screen.getByText("Đã lưu quyền của Nhân viên")).toBeVisible();
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
  expect(isMarked(screen, "Đăng bài")).toBe(false);
  release();
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  expect(writes).toHaveLength(1);
});

test("on a narrow screen a role picker replaces the list, and nothing scrolls sideways", async () => {
  mockRoles();
  await page.viewport(375, 800);
  try {
    const screen = await render(<Harness />);
    await expect.element(box(screen, "Xem người dùng")).toBeVisible();
    // The list is not drawn at all (nor read out): the picker stands in for it.
    expect(getComputedStyle(document.querySelector("[data-pane='list']")!).display).toBe("none");
    const picker = screen.getByRole("button", { name: /Nhân viên/ }).filter({ hasText: "Nhân viên" }).first();
    await expect.element(screen.getByText("Vai trò:")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Tạo vai trò" })).toBeVisible();
    await expect.element(saveButton(screen)).toBeVisible();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    const card = document.querySelector<HTMLElement>("[data-roles-card]")!;
    expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);

    // The picker switches roles (asking first when there are unsaved changes, as the list does).
    await userEvent.click(picker);
    await userEvent.click(screen.getByRole("option", { name: "Kế toán" }));
    await expect.element(shown(screen)).toHaveTextContent("Kế toán");
    await tick(screen, "Tạo người dùng");
    await userEvent.click(screen.getByRole("button", { name: /Kế toán/ }).filter({ hasText: "Kế toán" }).first());
    await userEvent.click(screen.getByRole("option", { name: "Biên tập" }));
    await expect.element(screen.getByRole("alertdialog")).toHaveTextContent("Lưu thay đổi của Kế toán?");
  } finally {
    await page.viewport(1000, 800);
  }
});

test("with unsaved changes the browser is asked before the tab is left", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  const unload = () => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  await expect.element(box(screen, "Đăng bài")).toBeVisible();
  expect(unload()).toBe(false);
  await tick(screen, "Đăng bài");
  expect(unload()).toBe(true);
  await userEvent.click(resetButton(screen));
  expect(unload()).toBe(false);
});

test("the admin tab links are guarded: through the real tab, leaving asks first", async () => {
  mockRoles();
  push.mockClear();
  const screen = await render(<Harness layout />);
  await tick(screen, "Đăng bài");
  await userEvent.click(screen.getByRole("tab", { name: "Người dùng" }));
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog).toHaveTextContent("Bỏ các thay đổi chưa lưu?");
  expect(push).not.toHaveBeenCalled();
  await userEvent.click(dialog.getByRole("button", { name: "Huỷ" }));
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
  await userEvent.click(screen.getByRole("tab", { name: "Người dùng" }));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Rời đi" }));
  expect(push).toHaveBeenCalledWith("/admin/users");
});

test("in the admin layout the page fills the height, and the list and the permissions scroll on their own", async () => {
  mockRoles();
  const screen = await render(<Harness layout />);
  await expect.element(box(screen, "Xem người dùng")).toBeVisible();
  const card = document.querySelector<HTMLElement>("[data-roles-card]")!;
  expect(card.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
  const list = roleList(screen).element().closest<HTMLElement>("[data-pane='list']")!;
  const detail = document.querySelector<HTMLElement>("[data-pane='permissions']")!;
  expect(getComputedStyle(list).overflowY).toBe("auto");
  expect(getComputedStyle(detail).overflowY).toBe("auto");
});

test("with nothing unsaved, a link is followed without asking", async () => {
  mockRoles();
  push.mockClear();
  const screen = await render(<Harness />);
  await expect.element(box(screen, "Đăng bài")).toBeVisible();
  // A real navigation would unload the test page, so the click is stopped here, after the page has had its say.
  const stop = (event: Event) => event.preventDefault();
  document.addEventListener("click", stop);
  try {
    await userEvent.click(screen.getByRole("link", { name: "Người dùng" }));
  } finally {
    document.removeEventListener("click", stop);
  }
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
});

test("the account menu's navigations are held back for the question while there are unsaved changes", async () => {
  mockRoles();
  navigate.mockClear();
  const screen = await render(<Harness />);
  await expect.element(box(screen, "Đăng bài")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  expect(navigate).toHaveBeenCalledTimes(1);

  await tick(screen, "Đăng bài");
  await userEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  const dialog = screen.getByRole("alertdialog");
  expect(navigate).toHaveBeenCalledTimes(1);
  await userEvent.click(dialog.getByRole("button", { name: "Huỷ" }));
  expect(navigate).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Rời đi" }));
  await vi.waitFor(() => expect(navigate).toHaveBeenCalledTimes(2));
});

test("the Back button asks first: cancel stays and guards it again, leave goes back for real", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await expect.element(box(screen, "Đăng bài")).toBeVisible();
  await vi.waitFor(() => expect(roleInUrl()).toBe("2"));
  const before = history.state?.__unsavedGuard;
  await tick(screen, "Đăng bài");
  expect(history.state?.__unsavedGuard).toBeDefined();
  expect(history.state?.__unsavedGuard).not.toBe(before);
  history.back();
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog).toHaveTextContent("Bỏ các thay đổi chưa lưu?");
  await userEvent.click(dialog.getByRole("button", { name: "Huỷ" }));
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
  history.back();
  await expect.element(screen.getByRole("alertdialog")).toBeVisible();
  const back = vi.spyOn(history, "back").mockImplementation(() => {});
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Rời đi" }));
  expect(back).toHaveBeenCalledTimes(1);
});

test("once nothing is unsaved the history entry of the guard is stepped back from", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  const token = history.state?.__unsavedGuard;
  expect(token).toBeDefined();
  await userEvent.click(resetButton(screen));
  await vi.waitFor(() => expect(history.state?.__unsavedGuard).not.toBe(token));
});

test("with unsaved changes, following a link inside the app asks first: cancel keeps the draft, leave goes on", async () => {
  mockRoles();
  push.mockClear();
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  await userEvent.click(screen.getByRole("link", { name: "Người dùng" }));
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog).toHaveTextContent("Bỏ các thay đổi chưa lưu?");
  expect(push).not.toHaveBeenCalled();
  await userEvent.click(dialog.getByRole("button", { name: "Huỷ" }));
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
  expect(push).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("link", { name: "Người dùng" }));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Rời đi" }));
  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/admin/users"));
});

test("leaving through a link steps off the guard's history entry first, so none is left behind", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  const token = history.state?.__unsavedGuard;
  expect(token).toBeDefined();
  // What the history holds at the moment the router is asked to go on.
  const seen: unknown[] = [];
  push.mockClear();
  push.mockImplementation(() => { seen.push(history.state?.__unsavedGuard); });
  try {
    await userEvent.click(screen.getByRole("link", { name: "Người dùng" }));
    await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Rời đi" }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/admin/users"));
    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toBe(token);
  } finally {
    push.mockReset();
  }
});

test("leaving through the account menu's navigation steps off the sentinel first as well", async () => {
  mockRoles();
  navigate.mockReset();
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  const token = history.state?.__unsavedGuard;
  const seen: unknown[] = [];
  navigate.mockImplementation(() => { seen.push(history.state?.__unsavedGuard); });
  await userEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Rời đi" }));
  await vi.waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  expect(seen[0]).not.toBe(token);
  navigate.mockReset();
});

test("Forward onto the sentinel asks nothing and Cancel never stacks a second sentinel", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  const token = history.state?.__unsavedGuard;
  history.back();
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog).toBeVisible();
  history.forward();
  await vi.waitFor(() => expect(history.state?.__unsavedGuard).toBe(token));
  const entries = history.length;
  await userEvent.click(dialog.getByRole("button", { name: "Huỷ" }));
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  expect(history.length).toBe(entries);
  expect(history.state?.__unsavedGuard).toBe(token);
  history.back();
  await expect.element(screen.getByRole("alertdialog")).toBeVisible();
});

test("a change of the hash is not a Back: no question", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await tick(screen, "Đăng bài");
  try {
    location.hash = "#somewhere";
    await new Promise(resolve => setTimeout(resolve, 300));
    await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  } finally {
    history.replaceState(history.state, "", location.pathname + location.search);
  }
});

test("stepping back from the sentinel after a reset keeps the scroll position the page is at", async () => {
  mockRoles();
  const screen = await render(<><Harness /><div style={{ height: 4000 }} /></>);
  await expect.element(box(screen, "Đăng bài")).toBeVisible();
  window.scrollTo(0, 100);
  // (Pressed by script: a pointer click would scroll the row into view.)
  (box(screen, "Đăng bài").element() as HTMLElement).click();
  await expect.element(box(screen, "Đăng bài")).toBeChecked();
  const token = history.state?.__unsavedGuard;
  window.scrollTo(0, 400);
  await vi.waitFor(() => expect(window.scrollY).toBe(400));
  (resetButton(screen).element() as HTMLElement).click();
  await vi.waitFor(() => expect(history.state?.__unsavedGuard).not.toBe(token));
  await new Promise(resolve => setTimeout(resolve, 200));
  expect(window.scrollY).toBe(400);
  expect(history.scrollRestoration).toBe("auto");
});
