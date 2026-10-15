import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type PermissionGroupDto, type RoleDto, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { RolesAdmin } from "./RolesAdmin";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/admin/roles" }));
afterEach(() => vi.restoreAllMocks());

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
  { id: 1, name: "Administrator", description: null, isAdmin: true, isDefault: false, permissions: everything, userCount: 1 },
  { id: 2, name: "Nhân viên", description: "Vai trò mặc định", isAdmin: false, isDefault: true, permissions: ["Users.View"], userCount: 5 },
  { id: 3, name: "Kế toán", description: null, isAdmin: false, isDefault: false, permissions: ["Users.View", "Posts.Create"], userCount: 2 },
];

type Write = { method: string; path: string; body: unknown };
/**
 * Answers the roles (`list`) and permissions, and each write with `reply` (no content by default); returns what was
 * requested: the writes (path with its query string) and every API path read or written.
 */
function mockRoles(reply: (write: Write) => Response = () => new Response(null, { status: 204 }), list: RoleDto[] = roles) {
  const writes: Write[] = [];
  const requested: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withRequest((url, init) => {
    // The API path, without the prefix the app reaches the back end through.
    const { pathname, search } = new URL(url);
    const path = pathname.replace(/^.*?(?=\/api\/)/, "");
    requested.push(path);
    if (path === "/api/Permissions") return Response.json(groups);
    if (path === "/api/Roles" && init.method === "GET") return Response.json(list);
    if (path.startsWith("/api/Roles")) {
      const write = { method: init.method, path: path + search, body: init.body ? JSON.parse(init.body) : null };
      writes.push(write);
      return reply(write);
    }
    return Response.json({});
  }));
  return { writes, requested };
}

function Harness({ isAdministrator = true }: { isAdministrator?: boolean }) {
  // One store per test: RTK Query keeps what it read, which must not leak from one test into the next.
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 1, fullName: "An", isAdministrator } as UserDto,
      permissions: [Permissions.Users.View],
    }));
    return own;
  });
  return <Provider store={store}><RolesAdmin /></Provider>;
}

test("not the administrator: no roles page", async () => {
  const { requested } = mockRoles();
  const screen = await render(<Harness isAdministrator={false} />);
  await expect.element(screen.getByText("Bạn không có quyền xem mục quản trị.")).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Vai trò & quyền" })).not.toBeInTheDocument();
  expect(requested.filter(path => path.startsWith("/api/Roles") || path.startsWith("/api/Permissions"))).toEqual([]);
});

test("the administrator sees the roles page", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("heading", { name: "Vai trò & quyền" })).toBeVisible();
  await expect.element(screen.getByRole("listitem", { name: "Kế toán" })).toBeVisible();
});

test("lists the roles: the default marked, the administrator locked, the number of people", async () => {
  mockRoles();
  const screen = await render(<Harness />);
  const staff = screen.getByRole("listitem", { name: "Nhân viên" });
  await expect.element(staff).toHaveTextContent("Mặc định");
  await expect.element(staff).toHaveTextContent("5 người");
  await expect.element(staff.getByRole("button", { name: "Xoá" })).not.toBeInTheDocument();
  const admin = screen.getByRole("listitem", { name: "Administrator" });
  await expect.element(admin.getByRole("img", { name: "Luôn có mọi quyền, không sửa được" })).toBeVisible();
  await expect.element(admin.getByRole("button", { name: "Xoá" })).not.toBeInTheDocument();
  // The administrator's role can be read, not changed.
  await expect.element(admin.getByRole("button", { name: "Xem" })).toBeVisible();
  await expect.element(admin.getByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
  const accountant = screen.getByRole("listitem", { name: "Kế toán" });
  await expect.element(accountant.getByRole("button", { name: "Xoá" })).toBeVisible();
  // The permission groups a role touches.
  await expect.element(accountant).toHaveTextContent("Người dùng");
  await expect.element(accountant).toHaveTextContent("Bài viết");
});

test("the administrator's role opens read-only with every permission ticked", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("listitem", { name: "Administrator" }).getByRole("button", { name: "Xem" }));
  const dialog = screen.getByRole("dialog");
  await expect.element(dialog.getByText("Luôn có mọi quyền, không sửa được")).toBeVisible();
  await expect.element(dialog.getByRole("checkbox", { name: "Đăng bài", exact: true })).toBeChecked();
  await expect.element(dialog.getByRole("checkbox", { name: "Đăng bài", exact: true })).toBeDisabled();
  await expect.element(dialog.getByRole("textbox", { name: "Tên vai trò" })).toHaveAttribute("readonly");
  await expect.element(dialog.getByRole("button", { name: "Lưu" })).not.toBeInTheDocument();
  expect(writes).toEqual([]);
});

test("creating a role posts its name and ticked permissions", async () => {
  const { writes } = mockRoles(() => Response.json(4, { status: 201 }));
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: "Tạo vai trò" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên vai trò" }), "Nhân sự");
  await dialog.getByRole("checkbox", { name: "Sửa người dùng", exact: true }).click({ force: true });
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "POST", path: "/api/Roles", body: { name: "Nhân sự", description: null, permissions: ["Users.Update"] } },
  ]));
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
});

test("editing a role puts its changed name, keeping its description and permissions", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("listitem", { name: "Nhân viên" }).getByRole("button", { name: "Sửa" }));
  const dialog = screen.getByRole("dialog");
  await expect.element(dialog.getByRole("textbox", { name: "Tên vai trò" })).toHaveValue("Nhân viên");
  await expect.element(dialog.getByRole("checkbox", { name: "Xem người dùng", exact: true })).toBeChecked();
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên vai trò" }), "Nhân viên chính thức");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "PUT", path: "/api/Roles/2", body: { name: "Nhân viên chính thức", description: "Vai trò mặc định", permissions: ["Users.View"] } },
  ]));
});

test("duplicating starts from the role's permissions", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("listitem", { name: "Kế toán" }).getByRole("button", { name: "Nhân bản" }));
  const dialog = screen.getByRole("dialog");
  await expect.element(dialog.getByRole("textbox", { name: "Tên vai trò" })).toHaveValue("Kế toán (bản sao)");
  await expect.element(dialog.getByRole("checkbox", { name: "Đăng bài", exact: true })).toBeChecked();
  // It is a new role: saving posts it.
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "POST", path: "/api/Roles", body: { name: "Kế toán (bản sao)", description: null, permissions: ["Users.View", "Posts.Create"] } },
  ]));
});

test("deleting a role people hold moves them to the chosen role", async () => {
  const { writes } = mockRoles();
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("listitem", { name: "Kế toán" }).getByRole("button", { name: "Xoá" }));
  const dialog = screen.getByRole("dialog");
  await expect.element(dialog).toHaveTextContent("2 người đang có vai trò này sẽ được chuyển sang:");
  // The default role is preselected.
  await expect.element(dialog.getByRole("button", { name: /Nhân viên/ })).toBeVisible();
  await userEvent.click(dialog.getByRole("button", { name: "Xoá", exact: true }));
  await vi.waitFor(() => expect(writes).toEqual([{ method: "DELETE", path: "/api/Roles/3?replacementRoleId=2", body: null }]));
});

test("deleting a role nobody holds only asks to confirm", async () => {
  const { writes } = mockRoles(undefined, roles.map(role => (role.id === 3 ? { ...role, userCount: 0 } : role)));
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("listitem", { name: "Kế toán" }).getByRole("button", { name: "Xoá" }));
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog).toHaveTextContent("Vai trò này chưa có ai giữ.");
  await userEvent.click(dialog.getByRole("button", { name: "Xoá", exact: true }));
  await vi.waitFor(() => expect(writes).toEqual([{ method: "DELETE", path: "/api/Roles/3", body: null }]));
});

/** A DELETE that stays unanswered until `release()`, so the dialog can be looked at while the request is on its way. */
function pendingDelete() {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  return { release, reply: async () => { await gate; return new Response(null, { status: 204 }); } };
}

test("while a delete of a role people hold is on its way, nothing can dismiss the question", async () => {
  const { release, reply } = pendingDelete();
  const { writes } = mockRoles(() => reply() as never);
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("listitem", { name: "Kế toán" }).getByRole("button", { name: "Xoá" }));
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

test("while a delete of a role nobody holds is on its way, nothing can dismiss the question", async () => {
  const { release, reply } = pendingDelete();
  const { writes } = mockRoles(() => reply() as never, roles.map(role => (role.id === 3 ? { ...role, userCount: 0 } : role)));
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("listitem", { name: "Kế toán" }).getByRole("button", { name: "Xoá" }));
  const dialog = screen.getByRole("alertdialog");
  await userEvent.click(dialog.getByRole("button", { name: "Xoá", exact: true }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  await expect.element(dialog.getByRole("button", { name: "Huỷ" })).toBeDisabled();
  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByRole("alertdialog")).toBeVisible();
  release();
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
});

test("a refusal is shown in the dialog", async () => {
  mockRoles(() => Response.json({ status: 409, code: "conflict", detail: "Vai trò thay thế không hợp lệ." }, { status: 409 }));
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("listitem", { name: "Kế toán" }).getByRole("button", { name: "Xoá" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.click(dialog.getByRole("button", { name: "Xoá", exact: true }));
  await expect.element(dialog.getByRole("alert")).toHaveTextContent("Vai trò thay thế không hợp lệ.");
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
