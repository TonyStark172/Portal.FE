import "@/app/globals.css";
import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type DepartmentDto, type PermissionGroupDto, type PositionDto, type RoleDto, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { CreateUserDialog } from "./CreateUserDialog";

afterEach(() => vi.restoreAllMocks());

/** Hands a mocked fetch what RTK Query sent (it passes a Request). */
const withRequest = (handler: (url: string, init: { method: string; body: string | null }) => Promise<Response> | Response) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    return handler(request.url, { method: request.method, body: ["GET", "HEAD"].includes(request.method) ? null : await request.clone().text() });
  };

const roles: RoleDto[] = [
  { id: 1, name: "Administrator", description: null, isAdmin: true, isDefault: false, permissions: [], userCount: 1 },
  { id: 2, name: "Nhân viên", description: null, isAdmin: false, isDefault: true, permissions: ["Users.View"], userCount: 5 },
  { id: 3, name: "Kế toán", description: null, isAdmin: false, isDefault: false, permissions: ["Posts.Create", "Users.View"], userCount: 2 },
];
const permissionGroups: PermissionGroupDto[] = [
  { group: "Users", permissions: ["Users.View", "Users.Create"] },
  { group: "Posts", permissions: ["Posts.View", "Posts.Create"] },
];
const departments: DepartmentDto[] = [
  { id: 3, code: "IT", name: "CNTT", originalName: "CNTT", parentId: null, parentName: null, isActive: true },
];
const positions: PositionDto[] = [
  { id: 5, code: "SPEC", name: "Chuyên viên", originalName: "Chuyên viên", level: 5, isActive: true },
];

type Write = { method: string; path: string; body: unknown };
/**
 * Answers the suggestion, departments, positions and roles, and `POST /api/Users` with `reply`; returns the writes and
 * every API path with its query string.
 */
function mockApi(
  reply: (write: Write) => Response = () => Response.json({ id: 9, temporaryPassword: "Abc123xyz456" }, { status: 201 }),
  /** Answers a suggestion for a name; by default each known name has its own, at once. */
  suggest: (fullName: string) => Promise<Response> | Response = (fullName) => Response.json({ userName: suggestions[fullName] ?? "an.nv2" }),
) {
  const writes: Write[] = [];
  const requested: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withRequest((url, init) => {
    const { pathname, search, searchParams } = new URL(url);
    const path = pathname.replace(/^.*?(?=\/api\/)/, "");
    requested.push(path + search);
    if (path === "/api/Users/username-suggestion") return suggest(searchParams.get("FullName") ?? "");
    if (path === "/api/Departments") return Response.json(departments);
    if (path === "/api/Positions") return Response.json(positions);
    if (path === "/api/Roles") return Response.json(roles);
    if (path === "/api/Permissions") return Response.json(permissionGroups);
    if (path === "/api/Users" && init.method === "POST") {
      const write = { method: init.method, path: path + search, body: JSON.parse(init.body ?? "null") };
      writes.push(write);
      return reply(write);
    }
    return Response.json({});
  }));
  return { writes, requested };
}

/** What the back end suggests for a name. */
const suggestions: Record<string, string> = { "Nguyễn Văn An": "an.nv2", "Nguyễn Văn Bình": "binh.nv" };

const everyAssignmentRight = [Permissions.Users.View, Permissions.Users.Create, Permissions.Departments.View, Permissions.Positions.View];

function Harness({ isAdministrator = false, permissions = everyAssignmentRight, onCreated = () => {}, onStore }: {
  isAdministrator?: boolean;
  permissions?: string[];
  onCreated?: (password: string, fullName: string) => void;
  /** Hands the test the store, to look at what RTK Query kept. */
  onStore?: (store: ReturnType<typeof makeStore>) => void;
}) {
  // One store per test: RTK Query keeps what it read, which must not leak from one test into the next.
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 9, fullName: "Quản lý", isAdministrator } as UserDto,
      permissions,
    }));
    return own;
  });
  useEffect(() => onStore?.(store), [onStore, store]);
  return <Provider store={store}><CreateUserDialog isOpen onOpenChange={() => {}} onCreated={onCreated} /></Provider>;
}

/**
 * Types the full name and leaves the field, then waits for the suggested username ("an.nv2") to arrive: typing the
 * username before it does would be typing into a field the suggestion is about to fill.
 */
async function introduce(screen: Awaited<ReturnType<typeof render>>) {
  await userEvent.fill(screen.getByRole("textbox", { name: "Họ và tên" }), "Nguyễn Văn An");
  await userEvent.tab();
  await expect.element(screen.getByRole("textbox", { name: "Tên đăng nhập" })).toHaveValue("an.nv2");
}

test("the username is suggested from the full name", async () => {
  const { requested } = mockApi();
  const screen = await render(<Harness />);
  await userEvent.fill(screen.getByRole("textbox", { name: "Họ và tên" }), "Nguyễn Văn An");
  await userEvent.tab();
  await expect.element(screen.getByRole("textbox", { name: "Tên đăng nhập" })).toHaveValue("an.nv2");
  expect(requested.filter(path => path.startsWith("/api/Users/username-suggestion"))).toHaveLength(1);
  const asked = requested.find(path => path.startsWith("/api/Users/username-suggestion"))!;
  expect(new URLSearchParams(asked.split("?")[1]).get("FullName")).toBe("Nguyễn Văn An");
});

test("a hand-typed username is not replaced", async () => {
  const { requested } = mockApi();
  const screen = await render(<Harness />);
  await userEvent.fill(screen.getByRole("textbox", { name: "Tên đăng nhập" }), "an");
  await userEvent.fill(screen.getByRole("textbox", { name: "Họ và tên" }), "Nguyễn Văn An");
  await userEvent.tab();
  // The suggestion is asked for and answered, and still the typed name stays.
  await vi.waitFor(() => expect(requested.some(path => path.startsWith("/api/Users/username-suggestion"))).toBe(true));
  await expect.element(screen.getByRole("textbox", { name: "Tên đăng nhập" })).toHaveValue("an");
});

test("a suggested username is replaced by a newer suggestion, until it is typed by hand", async () => {
  const { requested } = mockApi();
  const asked = () => requested.filter(path => path.startsWith("/api/Users/username-suggestion")).length;
  const screen = await render(<Harness />);
  const fullName = screen.getByRole("textbox", { name: "Họ và tên" });
  const userName = screen.getByRole("textbox", { name: "Tên đăng nhập" });
  await userEvent.fill(fullName, "Nguyễn Văn An");
  await userEvent.tab();
  await expect.element(userName).toHaveValue("an.nv2");
  // Another name, the username still a suggestion: the new suggestion takes its place.
  await userEvent.fill(fullName, "Nguyễn Văn Bình");
  await userEvent.tab();
  await expect.element(userName).toHaveValue("binh.nv");
  // Typing over a suggestion makes it the person's own: a later name no longer changes it.
  await userEvent.fill(userName, "an.nguyen");
  const before = asked();
  await userEvent.fill(fullName, "Nguyễn Văn An");
  await userEvent.tab();
  // Wait for the request of that later blur, and give its answer time to be applied (it must not be).
  await vi.waitFor(() => expect(asked()).toBe(before + 1));
  await new Promise(resolve => setTimeout(resolve, 300));
  await expect.element(userName).toHaveValue("an.nguyen");
});

test("a late answer for an older name does not replace the newer suggestion", async () => {
  // The first name's answer is slow; the second name's comes at once, so the slow one arrives last.
  let releaseSlow!: () => void;
  const slowGate = new Promise<void>(resolve => { releaseSlow = resolve; });
  let slowAsked = false;
  mockApi(undefined, async (fullName) => {
    if (fullName === "Nguyễn Văn An") {
      slowAsked = true;
      await slowGate;
    }
    return Response.json({ userName: suggestions[fullName] });
  });
  const screen = await render(<Harness />);
  const fullName = screen.getByRole("textbox", { name: "Họ và tên" });
  const userName = screen.getByRole("textbox", { name: "Tên đăng nhập" });
  await userEvent.fill(fullName, "Nguyễn Văn An");
  await userEvent.tab();
  await vi.waitFor(() => expect(slowAsked).toBe(true));
  await userEvent.fill(fullName, "Nguyễn Văn Bình");
  await userEvent.tab();
  await expect.element(userName).toHaveValue("binh.nv");
  // Now the old answer arrives: it is for a name that is no longer there.
  releaseSlow();
  await new Promise(resolve => setTimeout(resolve, 300));
  await expect.element(userName).toHaveValue("binh.nv");
});

test("not the administrator: the default role is told, not chosen, and no roles are sent", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await expect.element(screen.getByText("Vai trò: Nhân viên")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /Vai trò/ })).not.toBeInTheDocument();
  await introduce(screen);
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({ roleIds: [] });
});

test("the administrator picks roles: the default is preselected and the others are offered", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness isAdministrator />);
  await expect.element(screen.getByText("Vai trò: Nhân viên")).not.toBeInTheDocument();
  const select = screen.getByRole("button", { name: /Vai trò/ });
  await expect.element(select).toHaveTextContent("Nhân viên");
  await userEvent.click(select);
  // The administrator's role is not offered; another one is added to the default.
  await expect.element(screen.getByRole("option", { name: "Administrator" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("option", { name: "Kế toán" }));
  await userEvent.keyboard("{Escape}");
  await introduce(screen);
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({ roleIds: [2, 3] });
});

test("the administrator who leaves the default role gives it: roleIds is [2]", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness isAdministrator />);
  await expect.element(screen.getByRole("button", { name: /Vai trò/ })).toHaveTextContent("Nhân viên");
  await introduce(screen);
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({ roleIds: [2] });
});

test("creating sends the account and reports its temporary password", async () => {
  const { writes } = mockApi();
  const onCreated = vi.fn();
  const screen = await render(<Harness onCreated={onCreated} />);
  await introduce(screen);
  await userEvent.click(screen.getByRole("button", { name: /Phòng ban/ }));
  await userEvent.click(screen.getByRole("option", { name: "CNTT" }));
  await userEvent.click(screen.getByRole("button", { name: /Chức vụ/ }));
  await userEvent.click(screen.getByRole("option", { name: "Chuyên viên" }));
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  await vi.waitFor(() => expect(writes).toEqual([
    {
      method: "POST", path: "/api/Users",
      body: {
        userName: "an.nv2", fullName: "Nguyễn Văn An", email: null,
        assignments: [{ departmentId: 3, positionId: 5, isPrimary: true }], roleIds: [],
      },
    },
  ]));
  await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith("Abc123xyz456", "Nguyễn Văn An"));
});

test("the full name and the username are sent trimmed", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await userEvent.fill(screen.getByRole("textbox", { name: "Họ và tên" }), "  Nguyễn Văn An  ");
  await userEvent.tab();
  await expect.element(screen.getByRole("textbox", { name: "Tên đăng nhập" })).toHaveValue("an.nv2");
  await userEvent.fill(screen.getByRole("textbox", { name: "Tên đăng nhập" }), "  an.nv2  ");
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({ fullName: "Nguyễn Văn An", userName: "an.nv2" });
});

test("an email is sent as typed (the email input itself drops surrounding spaces)", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await introduce(screen);
  await userEvent.fill(screen.getByRole("textbox", { name: "Email (không bắt buộc)" }), "an@congty.vn");
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({ email: "an@congty.vn", assignments: [] });
});

test("without the right to see departments and positions: no assignment fields, none requested, none sent", async () => {
  const { writes, requested } = mockApi();
  const screen = await render(<Harness permissions={[Permissions.Users.View, Permissions.Users.Create, Permissions.Departments.View]} />);
  await expect.element(screen.getByRole("textbox", { name: "Họ và tên" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /Phòng ban/ })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: /Chức vụ/ })).not.toBeInTheDocument();
  await introduce(screen);
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({ assignments: [] });
  expect(requested.filter(path => path.startsWith("/api/Departments") || path.startsWith("/api/Positions"))).toEqual([]);
});

test("a department without a position is sent with no position", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await introduce(screen);
  await userEvent.click(screen.getByRole("button", { name: /Phòng ban/ }));
  await userEvent.click(screen.getByRole("option", { name: "CNTT" }));
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({ assignments: [{ departmentId: 3, positionId: null, isPrimary: true }] });
});

test("a position without a department is not sent", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await introduce(screen);
  await userEvent.click(screen.getByRole("button", { name: /Chức vụ/ }));
  await userEvent.click(screen.getByRole("option", { name: "Chuyên viên" }));
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Chọn phòng ban cho chức vụ này, hoặc để trống chức vụ.");
  expect(writes).toEqual([]);
});

test("a taken username shows on the field", async () => {
  mockApi(() => Response.json({
    status: 400, code: "validation_failed", detail: "Vui lòng kiểm tra lại các trường được báo lỗi.",
    errors: { UserName: ["Tên đăng nhập 'an.nv' đã tồn tại."] },
  }, { status: 400 }));
  const onCreated = vi.fn();
  const screen = await render(<Harness onCreated={onCreated} />);
  await introduce(screen);
  await userEvent.fill(screen.getByRole("textbox", { name: "Tên đăng nhập" }), "an.nv");
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  await expect.element(screen.getByText("Tên đăng nhập 'an.nv' đã tồn tại.")).toBeVisible();
  expect(onCreated).not.toHaveBeenCalled();
});

test("any other refusal shows in an alert", async () => {
  mockApi(() => Response.json({ status: 403, code: "forbidden", detail: "Bạn không được cấp vai trò này." }, { status: 403 }));
  const screen = await render(<Harness />);
  await introduce(screen);
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Bạn không được cấp vai trò này.");
});

test("the temporary password does not stay in the request state once it is handed over", async () => {
  mockApi();
  const onCreated = vi.fn();
  let store: ReturnType<typeof makeStore> | undefined;
  // The harness keeps the form mounted after success (its onOpenChange does nothing), so the form's own
  // mutation subscription is still alive when RTK's state is read: that is where the password would linger.
  const screen = await render(<Harness onCreated={onCreated} onStore={own => { store = own; }} />);
  await introduce(screen);
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith("Abc123xyz456", "Nguyễn Văn An"));
  await expect.element(screen.getByRole("textbox", { name: "Họ và tên" })).toBeVisible();
  await vi.waitFor(() => expect(JSON.stringify(store!.getState().api.mutations)).not.toContain("Abc123xyz456"));
});

test("an error on a key no field shows is not dropped: it is told beside the one on the field", async () => {
  mockApi(() => Response.json({
    status: 400, code: "validation_failed", detail: "Vui lòng kiểm tra lại các trường được báo lỗi.",
    errors: { UserName: ["Tên đăng nhập 'an.nv' đã tồn tại."], RoleIds: ["Có vai trò không tồn tại."] },
  }, { status: 400 }));
  const screen = await render(<Harness isAdministrator />);
  await introduce(screen);
  await userEvent.fill(screen.getByRole("textbox", { name: "Tên đăng nhập" }), "an.nv");
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  await expect.element(screen.getByText("Tên đăng nhập 'an.nv' đã tồn tại.")).toBeVisible();
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Có vai trò không tồn tại.");
});

test("an error on the assignments shows under the assignment fields", async () => {
  mockApi(() => Response.json({
    status: 400, code: "validation_failed", detail: "Vui lòng kiểm tra lại các trường được báo lỗi.",
    errors: { Assignments: ["Có phòng ban không tồn tại."] },
  }, { status: 400 }));
  const screen = await render(<Harness />);
  await introduce(screen);
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Có phòng ban không tồn tại.");
  await expect.element(screen.getByText("Vui lòng kiểm tra lại các trường được báo lỗi.")).not.toBeInTheDocument();
});

test("the administrator sees what the preselected default role allows, grouped by module", async () => {
  mockApi();
  const screen = await render(<Harness isAdministrator />);
  await expect.element(screen.getByText("Quyền của người này")).toBeVisible();
  const users = screen.getByRole("group", { name: "Người dùng" });
  await expect.element(users).toHaveTextContent("Xem người dùng");
  await expect.element(screen.getByRole("group", { name: "Bài viết" })).not.toBeInTheDocument();
});

test("adding a role adds its permissions once, and removing every role says nothing is held", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness isAdministrator />);
  await userEvent.click(screen.getByRole("button", { name: /Vai trò/ }));
  await userEvent.click(screen.getByRole("option", { name: "Kế toán" }));
  await userEvent.keyboard("{Escape}");
  // Both roles hold Users.View: it is listed once; the new role brings the Posts module.
  await expect.element(screen.getByRole("group", { name: "Bài viết" })).toHaveTextContent("Đăng bài");
  expect(screen.getByText("Xem người dùng").elements()).toHaveLength(1);

  await userEvent.click(screen.getByRole("button", { name: /Vai trò/ }));
  await userEvent.click(screen.getByRole("option", { name: "Kế toán" }));
  await userEvent.click(screen.getByRole("option", { name: "Nhân viên" }));
  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByText("Chưa có quyền nào — hãy chọn ít nhất một vai trò.")).toBeVisible();
  await expect.element(screen.getByRole("group", { name: "Người dùng" })).not.toBeInTheDocument();

  // Picking one back updates it again, and the request carries the chosen roles.
  await userEvent.click(screen.getByRole("button", { name: /Vai trò/ }));
  await userEvent.click(screen.getByRole("option", { name: "Kế toán" }));
  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByRole("group", { name: "Bài viết" })).toHaveTextContent("Đăng bài");
  await introduce(screen);
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản", exact: true }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({ roleIds: [3] });
});

test("not the administrator: no permission preview", async () => {
  const { requested } = mockApi();
  const screen = await render(<Harness />);
  await expect.element(screen.getByText("Vai trò: Nhân viên")).toBeVisible();
  await expect.element(screen.getByText("Quyền của người này")).not.toBeInTheDocument();
  expect(requested).not.toContain("/api/Permissions");
});
