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

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push }), usePathname: () => "/admin/roles" }));
afterEach(() => {
  vi.restoreAllMocks();
  toast.clear();
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

/** The box of a permission (by its plain name) under a role. The input is visually hidden, so it is pressed with `force`. */
// Its name gains "(chưa lưu)" while it has an unsaved change.
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cell = (screen: Awaited<ReturnType<typeof render>>, permission: string, role: string) =>
  screen.getByRole("checkbox", { name: new RegExp(`^${escaped(`${permission} — ${role}`)}( \\(chưa lưu\\))?$`) });

/** Whether the cell of a permission under a role is marked as changed (an unsaved draft). */
const isMarked = (screen: Awaited<ReturnType<typeof render>>, permission: string, role: string) =>
  cell(screen, permission, role).element().closest("td")?.hasAttribute("data-changed") ?? false;

/** Opens the "⋯" menu of a role's column and returns the menu. */
async function openMenu(screen: Awaited<ReturnType<typeof render>>, role: string) {
  await userEvent.click(screen.getByRole("button", { name: `Tuỳ chọn vai trò ${role}`, exact: true }));
  return screen.getByRole("menu");
}

/** A PUT / DELETE that stays unanswered until `release()`, so the page can be looked at while the request is on its way. */
function gated() {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  return { release, reply: async () => { await gate; return new Response(null, { status: 204 }); } };
}

test("not the administrator: no roles page", async () => {
  const { requested } = mockRoles();
  const screen = await render(<Harness isAdministrator={false} />);
  await expect.element(screen.getByText("Bạn không có quyền xem mục quản trị.")).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Vai trò & quyền" })).not.toBeInTheDocument();
  expect(requested.filter(path => path.startsWith("/api/Roles") || path.startsWith("/api/Permissions"))).toEqual([]);
});

test("the matrix: the groups and permissions down the side, the roles across (administrator, default, then by name)", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("heading", { name: "Vai trò & quyền" })).toBeVisible();
  await expect.element(screen.getByText("Quyền của một người là tổng quyền từ các vai trò của họ. Bấm Lưu thay đổi để áp dụng.")).toBeVisible();
  await expect.element(screen.getByRole("table")).toBeVisible();

  await vi.waitFor(() => {
    const headers = screen.getByRole("columnheader").all().map(header => header.element().textContent ?? "");
    expect(headers).toHaveLength(4);
    expect(headers[1]).toContain("Administrator");
    expect(headers[2]).toContain("Nhân viên");
    expect(headers[3]).toContain("Kế toán");
  });
  // The groups in catalogue order, each a section of the table with its name and its permissions' names in order.
  const sections = screen.getByRole("rowgroup").all().map(section => section.element()).filter(element => element.tagName === "TBODY");
  expect(sections.map(section => ({
    group: section.querySelector('th[scope="rowgroup"]')?.textContent,
    permissions: [...section.querySelectorAll('th[scope="row"]')].map(row => row.firstElementChild?.textContent),
  }))).toEqual([
    { group: "Người dùng", permissions: ["Xem người dùng", "Tạo người dùng", "Sửa người dùng"] },
    { group: "Bài viết", permissions: ["Đăng bài", "Quản lý bài viết"] },
  ]);
  // A permission with a description shows it under the name.
  await expect.element(screen.getByText("Xem danh sách và thông tin tài khoản của mọi người.")).toBeVisible();
});

test("the column headers: the default marked, the administrator locked, the number of people, a menu for all but the administrator", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  const staff = screen.getByRole("columnheader").filter({ hasText: "Nhân viên" });
  await expect.element(staff).toHaveTextContent("Mặc định");
  await expect.element(staff).toHaveTextContent("5 người");
  const admin = screen.getByRole("columnheader").filter({ hasText: "Administrator" });
  await expect.element(admin).toHaveTextContent("1 người");
  await expect.element(admin.getByRole("img", { name: "Luôn có mọi quyền" })).toBeVisible();
  await expect.element(admin.getByRole("button")).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Tuỳ chọn vai trò Kế toán", exact: true })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Tuỳ chọn vai trò Administrator", exact: true })).not.toBeInTheDocument();
});

test("the cells: ticked where the role holds the permission, the administrator's all ticked and fixed", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await expect.element(cell(screen, "Xem người dùng", "Nhân viên")).toBeChecked();
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).not.toBeChecked();
  await expect.element(cell(screen, "Đăng bài", "Kế toán")).toBeChecked();
  for (const permission of ["Xem người dùng", "Sửa người dùng", "Đăng bài", "Quản lý bài viết"]) {
    await expect.element(cell(screen, permission, "Administrator")).toBeChecked();
    await expect.element(cell(screen, permission, "Administrator")).toBeDisabled();
  }
});

test("ticking only changes the draft: nothing is sent, the cell is marked, the bar counts it", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
  await expect.element(screen.getByRole("button", { name: "Đặt lại" })).toBeDisabled();
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeVisible();

  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  await cell(screen, "Xem người dùng", "Kế toán").click({ force: true });
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeChecked();
  await expect.element(cell(screen, "Xem người dùng", "Kế toán")).not.toBeChecked();
  await expect.element(screen.getByText("2 thay đổi chưa lưu")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeEnabled();
  await expect.element(screen.getByRole("button", { name: "Đặt lại" })).toBeEnabled();
  // The changed cells are marked, the others are not.
  expect(isMarked(screen, "Đăng bài", "Nhân viên")).toBe(true);
  expect(isMarked(screen, "Xem người dùng", "Kế toán")).toBe(true);
  expect(isMarked(screen, "Xem người dùng", "Nhân viên")).toBe(false);
  expect(writes).toEqual([]);

  // Putting a cell back as it was is no change.
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  await expect.element(screen.getByText("1 thay đổi chưa lưu")).toBeVisible();
  expect(writes).toEqual([]);
});

test("saving sends one PUT per changed role with its full new set, and says so once", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  await cell(screen, "Tạo người dùng", "Nhân viên").click({ force: true });
  await cell(screen, "Xem người dùng", "Kế toán").click({ force: true });
  await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await vi.waitFor(() => expect(writes).toHaveLength(2));
  expect(writes).toEqual(expect.arrayContaining([
    { method: "PUT", path: "/api/Roles/2", body: { name: "Nhân viên", description: "Vai trò mặc định", permissions: ["Users.View", "Users.Create", "Posts.Create"] } },
    { method: "PUT", path: "/api/Roles/3", body: { name: "Kế toán", description: null, permissions: ["Posts.Create"] } },
  ]));
  await expect.element(screen.getByText("Đã lưu quyền")).toBeVisible();
  // Saved: no longer a change, and the boxes stay as they were set.
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeChecked();
  await expect.element(cell(screen, "Xem người dùng", "Kế toán")).not.toBeChecked();
  expect(writes).toHaveLength(2);
});

test("the reset button is disabled while nothing is unsaved", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Đặt lại" })).toBeDisabled();
  // The bottom bar has the save button alone.
  await expect.element(screen.getByRole("button", { name: "Huỷ thay đổi" })).not.toBeInTheDocument();
});

test("after a save, resetting undoes only the ticks made since", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();

  await cell(screen, "Quản lý bài viết", "Nhân viên").click({ force: true });
  await cell(screen, "Xem người dùng", "Nhân viên").click({ force: true });
  await expect.element(screen.getByText("2 thay đổi chưa lưu")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
  // The saved tick stays; the new ones are undone (a ticked box unticked again, an unticked one ticked again).
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeChecked();
  await expect.element(cell(screen, "Quản lý bài viết", "Nhân viên")).not.toBeChecked();
  await expect.element(cell(screen, "Xem người dùng", "Nhân viên")).toBeChecked();
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  expect(writes).toHaveLength(1);
});

test("resetting a few changes asks nothing; five or more ask first", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  // Four changes: no question.
  for (const permission of ["Tạo người dùng", "Sửa người dùng", "Đăng bài", "Quản lý bài viết"]) {
    await cell(screen, permission, "Nhân viên").click({ force: true });
  }
  await expect.element(screen.getByText("4 thay đổi chưa lưu")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();

  // Five: asks, and "Giữ lại" keeps the draft.
  for (const permission of ["Tạo người dùng", "Sửa người dùng", "Đăng bài", "Quản lý bài viết"]) {
    await cell(screen, permission, "Nhân viên").click({ force: true });
  }
  await cell(screen, "Xem người dùng", "Nhân viên").click({ force: true });
  await expect.element(screen.getByText("5 thay đổi chưa lưu")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog).toHaveTextContent("Bỏ 5 thay đổi chưa lưu?");
  await userEvent.click(dialog.getByRole("button", { name: "Giữ lại" }));
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  await expect.element(screen.getByText("5 thay đổi chưa lưu")).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Đặt lại" }));
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  await expect.element(cell(screen, "Xem người dùng", "Nhân viên")).toBeChecked();
  expect(writes).toEqual([]);
});

test("resetting puts the boxes back as the server has them, sending nothing", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  await cell(screen, "Xem người dùng", "Kế toán").click({ force: true });
  await userEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).not.toBeChecked();
  await expect.element(cell(screen, "Xem người dùng", "Kế toán")).toBeChecked();
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
  expect(writes).toEqual([]);
});

test("when one role's save is refused its draft stays marked and the reason is shown; the other is saved", async () => {
  const { writes } = mockRoles(write => write.path === "/api/Roles/3"
    ? Response.json({ status: 403, code: "forbidden", detail: "Bạn không được sửa vai trò này." }, { status: 403 })
    : new Response(null, { status: 204 }));
  const screen = await render(<Harness />);
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  await cell(screen, "Xem người dùng", "Kế toán").click({ force: true });
  await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await vi.waitFor(() => expect(writes).toHaveLength(2));
  // The reason comes with the name of the role it is about, and a summary says how many were saved.
  await expect.element(screen.getByText("Kế toán: Bạn không được sửa vai trò này.")).toBeVisible();
  await expect.element(screen.getByText("Đã lưu 1/2 vai trò")).toBeVisible();
  await expect.element(screen.getByText("Đã lưu quyền")).not.toBeInTheDocument();
  // The refused role keeps its draft (still unticked, still marked); the saved one is no change any more.
  await expect.element(cell(screen, "Xem người dùng", "Kế toán")).not.toBeChecked();
  expect(isMarked(screen, "Xem người dùng", "Kế toán")).toBe(true);
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeChecked();
  expect(isMarked(screen, "Đăng bài", "Nhân viên")).toBe(false);
  await expect.element(screen.getByText("1 thay đổi chưa lưu")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeEnabled();
});

test("with unsaved changes the browser is asked before the tab is left", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  const unload = () => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  expect(unload()).toBe(false);
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  expect(unload()).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
  expect(unload()).toBe(false);
});

test("with unsaved changes, following a link inside the app asks first: cancel keeps the draft, leave goes on", async () => {
  mockRoles();
  push.mockClear();
  const screen = await render(<Harness />);
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  await userEvent.click(screen.getByRole("link", { name: "Người dùng" }));
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog).toHaveTextContent("Bỏ các thay đổi chưa lưu?");
  expect(push).not.toHaveBeenCalled();
  await userEvent.click(dialog.getByRole("button", { name: "Huỷ" }));
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeChecked();
  expect(push).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("link", { name: "Người dùng" }));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Rời đi" }));
  expect(push).toHaveBeenCalledWith("/admin/users");
});

test("with nothing unsaved, a link is followed without asking", async () => {
  mockRoles();
  push.mockClear();
  const screen = await render(<Harness />);
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeVisible();
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

test("creating a role posts its name and description with no permissions, and its column appears", async () => {
  const { writes } = mockRoles(() => Response.json(4, { status: 201 }));
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: "Tạo vai trò" }));
  const dialog = screen.getByRole("dialog");
  // The dialog is the name and the description; the permissions are ticked in the matrix.
  await expect.element(dialog.getByRole("checkbox")).not.toBeInTheDocument();
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên vai trò" }), "Nhân sự");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Mô tả" }), "Phòng nhân sự");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "POST", path: "/api/Roles", body: { name: "Nhân sự", description: "Phòng nhân sự", permissions: [] } },
  ]));
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  await expect.element(screen.getByRole("columnheader").filter({ hasText: "Nhân sự" })).toBeVisible();
  await expect.element(cell(screen, "Đăng bài", "Nhân sự")).not.toBeChecked();
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

test("renaming opens the name and description and puts them with the role's permissions unchanged", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  const menu = await openMenu(screen, "Kế toán");
  await userEvent.click(menu.getByRole("menuitem", { name: "Đổi tên" }));
  const dialog = screen.getByRole("dialog");
  await expect.element(dialog.getByRole("checkbox")).not.toBeInTheDocument();
  await expect.element(dialog.getByRole("textbox", { name: "Tên vai trò" })).toHaveValue("Kế toán");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên vai trò" }), "Kế toán trưởng");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "PUT", path: "/api/Roles/3", body: { name: "Kế toán trưởng", description: null, permissions: ["Users.View", "Posts.Create"] } },
  ]));
  await expect.element(screen.getByRole("columnheader").filter({ hasText: "Kế toán trưởng" })).toBeVisible();
});

test("duplicating creates \"<name> (bản sao)\" with the same permissions and description, at once", async () => {
  const { writes } = mockRoles(() => Response.json(4, { status: 201 }));
  const screen = await render(<Harness />);
  const menu = await openMenu(screen, "Nhân viên");
  await userEvent.click(menu.getByRole("menuitem", { name: "Nhân bản" }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "POST", path: "/api/Roles", body: { name: "Nhân viên (bản sao)", description: "Vai trò mặc định", permissions: ["Users.View"] } },
  ]));
  await expect.element(screen.getByRole("columnheader").filter({ hasText: "Nhân viên (bản sao)" })).toBeVisible();
  await expect.element(cell(screen, "Xem người dùng", "Nhân viên (bản sao)")).toBeChecked();
});

test("deleting a role people hold asks which role they move to", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  const menu = await openMenu(screen, "Kế toán");
  await userEvent.click(menu.getByRole("menuitem", { name: "Xoá" }));
  const dialog = screen.getByRole("dialog");
  await expect.element(dialog).toHaveTextContent("2 người đang có vai trò này sẽ được chuyển sang:");
  // The default role is preselected.
  await expect.element(dialog.getByRole("button", { name: /Nhân viên/ })).toBeVisible();
  await userEvent.click(dialog.getByRole("button", { name: "Xoá", exact: true }));
  await vi.waitFor(() => expect(writes).toEqual([{ method: "DELETE", path: "/api/Roles/3?replacementRoleId=2", body: null }]));
  await expect.element(screen.getByRole("columnheader").filter({ hasText: "Kế toán" })).not.toBeInTheDocument();
});

test("deleting a role nobody holds only asks to confirm", async () => {
  const { writes } = mockRoles(undefined, roles.map(role => (role.id === 3 ? { ...role, userCount: 0 } : role)));
  const screen = await render(<Harness />);
  const menu = await openMenu(screen, "Kế toán");
  await userEvent.click(menu.getByRole("menuitem", { name: "Xoá" }));
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog).toHaveTextContent("Vai trò này chưa có ai giữ.");
  await userEvent.click(dialog.getByRole("button", { name: "Xoá", exact: true }));
  await vi.waitFor(() => expect(writes).toEqual([{ method: "DELETE", path: "/api/Roles/3", body: null }]));
});

test("the default role has no \"Xoá\", and the administrator has no menu at all", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  const menu = await openMenu(screen, "Nhân viên");
  await expect.element(menu.getByRole("menuitem", { name: "Đổi tên" })).toBeVisible();
  await expect.element(menu.getByRole("menuitem", { name: "Nhân bản" })).toBeVisible();
  await expect.element(menu.getByRole("menuitem", { name: "Xoá" })).not.toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByRole("columnheader").filter({ hasText: "Administrator" }).getByRole("button")).not.toBeInTheDocument();
  expect(writes).toEqual([]);
});

test("while a delete of a role people hold is on its way, nothing can dismiss the question", async () => {
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
  mockRoles(() => Response.json({ status: 409, code: "conflict", detail: "Vai trò thay thế không hợp lệ." }, { status: 409 }));
  const screen = await render(<Harness />);
  const menu = await openMenu(screen, "Kế toán");
  await userEvent.click(menu.getByRole("menuitem", { name: "Xoá" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.click(dialog.getByRole("button", { name: "Xoá", exact: true }));
  await expect.element(dialog.getByRole("alert")).toHaveTextContent("Vai trò thay thế không hợp lệ.");
});

test("a changed cell is told apart without colour (a ring) and to a screen reader (\"chưa lưu\"); a description is linked to its boxes", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  const ring = (permission: string, role: string) => getComputedStyle(cell(screen, permission, role).element().closest("td")!).boxShadow;
  await expect.element(cell(screen, "Xem người dùng", "Nhân viên")).toHaveAccessibleDescription("Xem danh sách và thông tin tài khoản của mọi người.");
  expect(ring("Đăng bài", "Nhân viên")).toBe("none");
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  await expect.element(screen.getByRole("checkbox", { name: "Đăng bài — Nhân viên (chưa lưu)", exact: true })).toBeChecked();
  expect(ring("Đăng bài", "Nhân viên")).not.toBe("none");
  expect(ring("Đăng bài", "Kế toán")).toBe("none");
  // Back to how it is saved: no longer unsaved.
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  await expect.element(screen.getByRole("checkbox", { name: "Đăng bài — Nhân viên", exact: true })).not.toBeChecked();
});

test("the whole cell is the target: at least 44px, and a press near its corner toggles", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeVisible();
  const td = cell(screen, "Đăng bài", "Nhân viên").element().closest("td")!;
  const target = td.querySelector<HTMLElement>('[data-slot="checkbox-content"]')!;
  expect(target.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  expect(target.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
  expect(Math.abs(target.getBoundingClientRect().width - td.getBoundingClientRect().width)).toBeLessThan(2);
  await userEvent.click(page.elementLocator(td), { position: { x: 4, y: 4 } });
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeChecked();
});

test("on a phone the matrix scrolls sideways only (no height cap that would trap the page's scroll)", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeVisible();
  const scroller = screen.getByRole("table").element().parentElement!;
  expect(getComputedStyle(scroller).maxHeight).not.toBe("none");
  await page.viewport(390, 800);
  try {
    await vi.waitFor(() => expect(getComputedStyle(scroller).maxHeight).toBe("none"));
    expect(getComputedStyle(scroller).overflowX).toBe("auto");
  } finally {
    await page.viewport(1000, 800);
  }
});

test("a list read again composes with the user's ticks: another administrator's change shows, only the user's own is sent", async () => {
  const { writes, setServer } = mockRoles();
  const screen = await render(<Harness />);
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  // Another administrator gives "Nhân viên" the permission to create users, and the page reads the roles again.
  setServer(roles.map(role => (role.id === 2 ? { ...role, permissions: ["Users.View", "Users.Create"] } : role)));
  void refetchRoles();
  await expect.element(cell(screen, "Tạo người dùng", "Nhân viên")).toBeChecked();
  expect(isMarked(screen, "Tạo người dùng", "Nhân viên")).toBe(false);
  expect(isMarked(screen, "Đăng bài", "Nhân viên")).toBe(true);
  await expect.element(screen.getByText("1 thay đổi chưa lưu")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "PUT", path: "/api/Roles/2", body: { name: "Nhân viên", description: "Vai trò mặc định", permissions: ["Users.View", "Users.Create", "Posts.Create"] } },
  ]));
});

test("a tick the server comes to agree with is no change any more", async () => {
  const { writes, setServer } = mockRoles();
  const screen = await render(<Harness />);
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  await expect.element(screen.getByText("1 thay đổi chưa lưu")).toBeVisible();
  setServer(roles.map(role => (role.id === 2 ? { ...role, permissions: ["Users.View", "Posts.Create"] } : role)));
  void refetchRoles();
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeChecked();
  expect(isMarked(screen, "Đăng bài", "Nhân viên")).toBe(false);
  await expect.element(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
  expect(writes).toEqual([]);
});

test("right after a save the boxes keep the saved state until the roles are read again (no jump back)", async () => {
  const { writes, holdReads } = mockRoles();
  const screen = await render(<Harness />);
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  const release = holdReads();
  await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  await expect.element(screen.getByText("Đã lưu quyền")).toBeVisible();
  // The read that follows the save has not been answered: the list still has the old permissions.
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeChecked();
  expect(isMarked(screen, "Đăng bài", "Nhân viên")).toBe(false);
  release();
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeChecked();
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  expect(writes).toHaveLength(1);
});

test("renaming a role with unsaved ticks sends its SAVED permissions and keeps the draft, which then saves under the new name", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  const menu = await openMenu(screen, "Nhân viên");
  await userEvent.click(menu.getByRole("menuitem", { name: "Đổi tên" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên vai trò" }), "Nhân viên chính thức");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "PUT", path: "/api/Roles/2", body: { name: "Nhân viên chính thức", description: "Vai trò mặc định", permissions: ["Users.View"] } },
  ]));
  await expect.element(screen.getByRole("columnheader").filter({ hasText: "Nhân viên chính thức" })).toBeVisible();
  await expect.element(cell(screen, "Đăng bài", "Nhân viên chính thức")).toBeChecked();
  expect(isMarked(screen, "Đăng bài", "Nhân viên chính thức")).toBe(true);
  await expect.element(screen.getByText("1 thay đổi chưa lưu")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await vi.waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[1]).toEqual({
    method: "PUT", path: "/api/Roles/2",
    body: { name: "Nhân viên chính thức", description: "Vai trò mặc định", permissions: ["Users.View", "Posts.Create"] },
  });
});

test("duplicating a role with unsaved ticks copies what is SAVED and keeps the draft", async () => {
  const { writes } = mockRoles(() => Response.json(4, { status: 201 }));
  const screen = await render(<Harness />);
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  const menu = await openMenu(screen, "Nhân viên");
  await userEvent.click(menu.getByRole("menuitem", { name: "Nhân bản" }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "POST", path: "/api/Roles", body: { name: "Nhân viên (bản sao)", description: "Vai trò mặc định", permissions: ["Users.View"] } },
  ]));
  await expect.element(cell(screen, "Xem người dùng", "Nhân viên (bản sao)")).toBeChecked();
  await expect.element(cell(screen, "Đăng bài", "Nhân viên (bản sao)")).not.toBeChecked();
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeChecked();
  await expect.element(screen.getByText("1 thay đổi chưa lưu")).toBeVisible();
});

test("a copy of a role whose name is taken gets a number", async () => {
  const taken = [...roles, { id: 4, name: "Nhân viên (bản sao)", description: null, isAdmin: false, isDefault: false, permissions: [], userCount: 0 }];
  const { writes } = mockRoles(() => Response.json(5, { status: 201 }), taken);
  const screen = await render(<Harness />);
  const menu = await openMenu(screen, "Nhân viên");
  await userEvent.click(menu.getByRole("menuitem", { name: "Nhân bản" }));
  await vi.waitFor(() => expect(writes.map(write => (write.body as { name: string }).name)).toEqual(["Nhân viên (bản sao) 2"]));
});

test("deleting a role that has unsaved ticks drops them: nothing is left to save", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await cell(screen, "Tạo người dùng", "Kế toán").click({ force: true });
  await expect.element(screen.getByText("1 thay đổi chưa lưu")).toBeVisible();
  const menu = await openMenu(screen, "Kế toán");
  await userEvent.click(menu.getByRole("menuitem", { name: "Xoá" }));
  await userEvent.click(screen.getByRole("dialog").getByRole("button", { name: "Xoá", exact: true }));
  await vi.waitFor(() => expect(writes).toEqual([{ method: "DELETE", path: "/api/Roles/3?replacementRoleId=2", body: null }]));
  await expect.element(screen.getByRole("columnheader").filter({ hasText: "Kế toán" })).not.toBeInTheDocument();
  await expect.element(screen.getByText("Chưa có thay đổi nào")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
});

test("the admin tab links are guarded too: through the real tab, leaving asks first", async () => {
  mockRoles();
  push.mockClear();
  const screen = await render(<Harness layout />);
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  await userEvent.click(screen.getByRole("tab", { name: "Người dùng" }));
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog).toHaveTextContent("Bỏ các thay đổi chưa lưu?");
  expect(push).not.toHaveBeenCalled();
  await userEvent.click(dialog.getByRole("button", { name: "Rời đi" }));
  expect(push).toHaveBeenCalledWith("/admin/users");
});

test("the Back button asks first: cancel stays and guards it again, leave goes back for real", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  const before = history.state?.__unsavedGuard;
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  // An entry was added for Back to land on.
  expect(history.state?.__unsavedGuard).toBeDefined();
  expect(history.state?.__unsavedGuard).not.toBe(before);
  history.back();
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog).toHaveTextContent("Bỏ các thay đổi chưa lưu?");
  await userEvent.click(dialog.getByRole("button", { name: "Huỷ" }));
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeChecked();
  // Guarded again.
  history.back();
  await expect.element(screen.getByRole("alertdialog")).toBeVisible();
  const back = vi.spyOn(history, "back").mockImplementation(() => {});
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Rời đi" }));
  expect(back).toHaveBeenCalledTimes(1);
});

test("once nothing is unsaved the history entry of the guard is stepped back from", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  const token = history.state?.__unsavedGuard;
  expect(token).toBeDefined();
  await userEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
  await vi.waitFor(() => expect(history.state?.__unsavedGuard).not.toBe(token));
});

test("the account menu's navigations (settings, sign out) are held back for the question while there are unsaved changes", async () => {
  mockRoles();
  navigate.mockClear();
  const screen = await render(<Harness />);
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeVisible();
  // Nothing unsaved: it goes straight through.
  await userEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  expect(navigate).toHaveBeenCalledTimes(1);

  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  await userEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  const dialog = screen.getByRole("alertdialog");
  expect(navigate).toHaveBeenCalledTimes(1);
  await userEvent.click(dialog.getByRole("button", { name: "Huỷ" }));
  expect(navigate).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Rời đi" }));
  expect(navigate).toHaveBeenCalledTimes(2);
});

test("leaving through a link steps off the guard's history entry first, so none is left behind", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
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
    // It was called after the step back, from the page's own entry, not from the sentinel.
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
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
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
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  const token = history.state?.__unsavedGuard;
  history.back();
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog).toBeVisible();
  // Forward lands on the sentinel again: the question stays as it is, no second one opens.
  history.forward();
  await vi.waitFor(() => expect(history.state?.__unsavedGuard).toBe(token));
  const entries = history.length;
  await userEvent.click(dialog.getByRole("button", { name: "Huỷ" }));
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  // Cancel found the sentinel in place and added nothing.
  expect(history.length).toBe(entries);
  expect(history.state?.__unsavedGuard).toBe(token);
  // And Back is guarded as before.
  history.back();
  await expect.element(screen.getByRole("alertdialog")).toBeVisible();
});

test("a change of the hash is not a Back: no question", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
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
  await expect.element(cell(screen, "Đăng bài", "Nhân viên")).toBeVisible();
  window.scrollTo(0, 100);
  await cell(screen, "Đăng bài", "Nhân viên").click({ force: true });
  const token = history.state?.__unsavedGuard;
  // Scrolled on after the guard's entry was made: going back must not take the page to where it was then.
  window.scrollTo(0, 400);
  await vi.waitFor(() => expect(window.scrollY).toBe(400));
  // (Pressed by script: a pointer click would scroll the button, at the top of the page, into view.)
  (screen.getByRole("button", { name: "Đặt lại" }).element() as HTMLElement).click();
  await vi.waitFor(() => expect(history.state?.__unsavedGuard).not.toBe(token));
  await new Promise(resolve => setTimeout(resolve, 200));
  expect(window.scrollY).toBe(400);
  // The browser's own scroll restoration is back once the guard has let go.
  expect(history.scrollRestoration).toBe("auto");
});
