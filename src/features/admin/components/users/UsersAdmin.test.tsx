import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { Toast, toast } from "@heroui/react";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type DepartmentDto, type InvitationDto, type RoleDto, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { UsersAdmin } from "./UsersAdmin";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/admin/users" }));
afterEach(() => {
  vi.restoreAllMocks();
  toast.clear();
});

/** Hands a mocked fetch what RTK Query sent (it passes a Request). */
const withRequest = (handler: (url: string, method: string) => Promise<Response> | Response) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    return handler(request.url, request.method);
  };

const roles: RoleDto[] = [
  { id: 1, name: "Administrator", description: null, isAdmin: true, isDefault: false, permissions: [], userCount: 1 },
  { id: 2, name: "Nhân viên", description: null, isAdmin: false, isDefault: true, permissions: [], userCount: 5 },
];
const departments: DepartmentDto[] = [
  { id: 3, code: "IT", name: "CNTT", originalName: "CNTT", parentId: null, parentName: null, isActive: true },
];
const users: UserDto[] = [
  {
    id: 1, fullName: "Quản trị", userName: "admin", emailConfirmed: true, isAdministrator: true, isActive: true,
    mustChangePassword: false, roles: [{ id: 1, name: "Administrator" }], assignments: [],
    lastLoginAt: new Date(Date.now() - 2 * 3_600_000).toISOString(), joinedOn: "2025-03-07",
  },
  {
    id: 2, fullName: "Nguyễn Văn An", userName: "an.nv", emailConfirmed: true, isAdministrator: false, isActive: true,
    mustChangePassword: true, roles: [{ id: 2, name: "Nhân viên" }],
    assignments: [{ departmentId: 3, departmentName: "CNTT", positionId: 5, positionName: "Nhân viên", positionLevel: 5, role: "Member", isPrimary: true }],
  },
];

const invitations: InvitationDto[] = [
  {
    id: 7, email: "binh@congty.com", roleId: 2, roleName: "Nhân viên", invitedByName: "Quản trị",
    createdAt: "2026-10-19T07:30:00Z", expiresAt: new Date(2026, 9, 21, 14, 30).toISOString(), status: "Pending", lastSendFailedAt: null,
  },
  {
    id: 6, email: "cuong@congty.com", roleId: 2, roleName: "Nhân viên", invitedByName: "Quản trị",
    createdAt: "2026-10-10T07:30:00Z", expiresAt: new Date(2026, 9, 12, 9, 5).toISOString(), status: "Expired", lastSendFailedAt: null,
  },
];

/**
 * Answers the users (a page of `list`, as the page asked for), the invitations, departments and roles; returns every
 * API path with its query string, in order.
 */
function mockUsers(list: UserDto[] = users, paging: {
  totalCount?: number; totalPages?: number; failing?: { value: boolean }; invitations?: InvitationDto[]; refuseResend?: boolean;
} = {}) {
  const requested: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withRequest((url, method) => {
    const { pathname, search, searchParams } = new URL(url);
    const path = pathname.replace(/^.*?(?=\/api\/)/, "");
    requested.push(`${method === "GET" ? "" : `${method} `}${path}${search}`);
    if (path === "/api/Users" && method === "POST") return Response.json({ id: 9, temporaryPassword: "Abc123xyz456" }, { status: 201 });
    if (path === "/api/Users/username-suggestion") return Response.json({ userName: "binh.nv" });
    if (/^\/api\/Users\/\d+\/password$/.test(path)) return Response.json({ temporaryPassword: "Xyz234abc567" });
    if (/^\/api\/Users\/\d+$/.test(path) && method !== "GET") return new Response(null, { status: 204 });
    if (path === "/api/Users") {
      if (paging.failing?.value) return new Response(null, { status: 500 });
      const pageNumber = Number(searchParams.get("PageNumber") ?? 1);
      const totalPages = paging.totalPages ?? 1;
      return Response.json({
        items: list, pageNumber, totalPages, totalCount: paging.totalCount ?? list.length,
        hasPreviousPage: pageNumber > 1, hasNextPage: pageNumber < totalPages,
      });
    }
    if (path === "/api/Invitations/availability") return Response.json({ canSendEmail: true });
    if (path === "/api/Invitations/6/resend" && paging.refuseResend) {
      return Response.json({ status: 409, code: "conflict", detail: "Lời mời này đã được chấp nhận." }, { status: 409 });
    }
    if (/^\/api\/Invitations\/\d+\/(resend|revoke)$/.test(path)) return new Response(null, { status: 204 });
    if (path === "/api/Invitations") return Response.json(paging.invitations ?? []);
    if (path === "/api/Departments") return Response.json(departments);
    if (path === "/api/Roles") return Response.json(roles);
    return Response.json({});
  }));
  return requested;
}

function Harness({ permissions = [Permissions.Users.View, Permissions.Departments.View], myId = 9 }: { permissions?: string[]; myId?: number }) {
  // One store per test: RTK Query keeps what it read, which must not leak from one test into the next.
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: myId, fullName: "Quản lý", isAdministrator: false } as UserDto,
      permissions,
    }));
    return own;
  });
  return <Provider store={store}><Toast.Provider /><UsersAdmin /></Provider>;
}

const usersRequests = (requested: string[]) => requested.filter(path => path.startsWith("/api/Users"));

test("without the right to view users, the no-access alert and no request", async () => {
  const requested = mockUsers();
  const screen = await render(<Harness permissions={[]} />);
  await expect.element(screen.getByText("Bạn không có quyền xem mục quản trị.")).toBeVisible();
  await expect.element(screen.getByRole("searchbox", { name: "Tìm người dùng" })).not.toBeInTheDocument();
  expect(requested).toEqual([]);
});

test("lists people with their roles and status", async () => {
  mockUsers();
  const screen = await render(<Harness />);
  const admin = screen.getByRole("row", { name: /Quản trị/ });
  await expect.element(admin).toHaveTextContent("Quản trị viên");
  // The administrator's own role is not repeated beside the "Quản trị viên" chip.
  await expect.element(admin).not.toHaveTextContent("Administrator");
  await expect.element(admin).toHaveTextContent("Active");
  await expect.element(admin).not.toHaveTextContent("Chờ đổi mật khẩu");
  // The day they joined, dd/MM/yyyy; the last sign-in is no column any more.
  await expect.element(admin).toHaveTextContent("07/03/2025");
  await expect.element(admin).not.toHaveTextContent("2 giờ trước");
  const an = screen.getByRole("row", { name: /Nguyễn Văn An/ });
  await expect.element(an).toHaveTextContent("an.nv");
  await expect.element(an).toHaveTextContent("CNTT · Nhân viên");
  // Waiting for a first password is a chip beside the status, not a status of its own.
  await expect.element(an).toHaveTextContent("Active");
  await expect.element(an).toHaveTextContent("Chờ đổi mật khẩu");
  // No join date on record: a dash, not "never signed in".
  await expect.element(an).not.toHaveTextContent("Chưa đăng nhập");
  await expect.element(screen.getByRole("columnheader", { name: "Ngày tham gia" })).toBeVisible();
  await expect.element(screen.getByRole("columnheader", { name: "Đăng nhập gần nhất" })).not.toBeInTheDocument();
  await expect.element(an).toHaveTextContent("—");
});

test("a person with a department but no position shows the department alone", async () => {
  mockUsers([{
    ...users[1],
    assignments: [{ departmentId: 3, departmentName: "CNTT", positionId: null, positionName: null, positionLevel: null, role: "Member", isPrimary: true }],
  }]);
  const screen = await render(<Harness />);
  const row = screen.getByRole("row", { name: /Nguyễn Văn An/ });
  await expect.element(row).toHaveTextContent("CNTT");
  await expect.element(row).not.toHaveTextContent("CNTT ·");
});

test("a person who left shows as deactivated, even when they never changed the password", async () => {
  mockUsers([{ ...users[1], isActive: false }]);
  const screen = await render(<Harness />);
  const row = screen.getByRole("row", { name: /Nguyễn Văn An/ });
  await expect.element(row).toHaveTextContent("Deactivated");
  await expect.element(row).not.toHaveTextContent("Active");
  await expect.element(row).not.toHaveTextContent("Chờ đổi mật khẩu");
});

test("searching asks the server, from the first page", async () => {
  const requested = mockUsers(users, { totalCount: 25, totalPages: 3 });
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("row", { name: /Nguyễn Văn An/ })).toBeVisible();
  // Go to page 2 first: a new search must come back to page 1.
  await userEvent.click(screen.getByRole("button", { name: "2", exact: true }));
  await vi.waitFor(() => expect(usersRequests(requested)).toContain("/api/Users?PageNumber=2&PageSize=10"));
  await userEvent.fill(screen.getByRole("searchbox", { name: "Tìm người dùng" }), "an");
  await vi.waitFor(() => expect(usersRequests(requested).at(-1)).toBe("/api/Users?Search=an&PageNumber=1&PageSize=10"));
});

test("every filter says what it is, even when set to all", async () => {
  mockUsers();
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("row", { name: /Nguyễn Văn An/ })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /Phòng ban/ })).toHaveTextContent("Phòng ban: Tất cả");
  await expect.element(screen.getByRole("button", { name: /Vai trò/ })).toHaveTextContent("Vai trò: Tất cả");
  await expect.element(screen.getByRole("button", { name: /Trạng thái/ })).toHaveTextContent("Trạng thái: Tất cả");
  await userEvent.click(screen.getByRole("button", { name: /Trạng thái/ }));
  await userEvent.click(screen.getByRole("option", { name: "Pending" }));
  await expect.element(screen.getByRole("button", { name: /Trạng thái/ })).toHaveTextContent("Trạng thái: Pending");
});

test("filtering by role and status", async () => {
  const requested = mockUsers(users, { totalCount: 25, totalPages: 3 });
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("row", { name: /Nguyễn Văn An/ })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "2", exact: true }));
  await vi.waitFor(() => expect(usersRequests(requested)).toContain("/api/Users?PageNumber=2&PageSize=10"));

  await userEvent.click(screen.getByRole("button", { name: /Vai trò/ }));
  await userEvent.click(screen.getByRole("option", { name: "Nhân viên" }));
  await vi.waitFor(() => expect(usersRequests(requested).at(-1)).toBe("/api/Users?RoleId=2&PageNumber=1&PageSize=10"));

  await userEvent.click(screen.getByRole("button", { name: /Trạng thái/ }));
  await userEvent.click(screen.getByRole("option", { name: "Deactivated" }));
  await vi.waitFor(() => expect(usersRequests(requested).at(-1)).toBe("/api/Users?IsActive=false&RoleId=2&PageNumber=1&PageSize=10"));

  // "Active" is a true IsActive (and "all", as in the first requests, leaves it out).
  await userEvent.click(screen.getByRole("button", { name: /Trạng thái/ }));
  await userEvent.click(screen.getByRole("option", { name: "Active" }));
  await vi.waitFor(() => expect(usersRequests(requested).at(-1)).toBe("/api/Users?IsActive=true&RoleId=2&PageNumber=1&PageSize=10"));
});

test("the status filter: Pending shows the invitations alone, Active and Deactivated the accounts alone", async () => {
  const requested = mockUsers(users, { invitations });
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("row", { name: /binh@congty.com/ })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: /Trạng thái/ }));
  expect(screen.getByRole("option").elements().map((option) => option.textContent)).toEqual(["Tất cả", "Pending", "Active", "Deactivated"]);

  await userEvent.click(screen.getByRole("option", { name: "Pending" }));
  await expect.element(screen.getByRole("row", { name: /Nguyễn Văn An/ })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("row", { name: /binh@congty.com/ })).toBeVisible();
  // The invitation that ran out has not been taken up either: it is still waiting on that person.
  await expect.element(screen.getByRole("row", { name: /cuong@congty.com/ })).toBeVisible();
  // The accounts are not asked for again: none of them is pending.
  expect(usersRequests(requested)).toEqual(["/api/Users?PageNumber=1&PageSize=10"]);

  await userEvent.click(screen.getByRole("button", { name: /Trạng thái/ }));
  await userEvent.click(screen.getByRole("option", { name: "Active" }));
  await vi.waitFor(() => expect(usersRequests(requested).at(-1)).toBe("/api/Users?IsActive=true&PageNumber=1&PageSize=10"));
  await expect.element(screen.getByRole("row", { name: /Nguyễn Văn An/ })).toBeVisible();
  await expect.element(screen.getByRole("row", { name: /binh@congty.com/ })).not.toBeInTheDocument();
});

test("invitations come first: pending with when it expires, expired as such", async () => {
  mockUsers(users, { invitations });
  const screen = await render(<Harness />);
  const pending = screen.getByRole("row", { name: /binh@congty.com/ });
  await expect.element(pending).toHaveTextContent("Pending");
  await expect.element(pending).toHaveTextContent("Hết hạn lúc 14:30 ngày 21/10");
  await expect.element(pending).toHaveTextContent("Nhân viên");
  await expect.element(pending).toHaveTextContent("Mời bởi Quản trị");
  // In the join date's column: when the invitation went out.
  await expect.element(pending).toHaveTextContent("Mời ngày 19/10/2026");
  const expired = screen.getByRole("row", { name: /cuong@congty.com/ });
  await expect.element(expired).toHaveTextContent("Hết hạn");
  await expect.element(expired).not.toHaveTextContent("Pending");
  const names = screen.getByRole("rowheader").elements().map((cell) => cell.textContent);
  expect(names.map((name) => name?.match(/binh@|cuong@|Quản trị|Nguyễn Văn An/)?.[0])).toEqual(["binh@", "cuong@", "Quản trị", "Nguyễn Văn An"]);
});

test("invitations are on the first page only, and only while no department or other status is chosen", async () => {
  const requested = mockUsers(users, { invitations, totalCount: 25, totalPages: 3 });
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("row", { name: /binh@congty.com/ })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "2", exact: true }));
  await vi.waitFor(() => expect(usersRequests(requested)).toContain("/api/Users?PageNumber=2&PageSize=10"));
  await expect.element(screen.getByRole("row", { name: /binh@congty.com/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "1", exact: true }));
  await expect.element(screen.getByRole("row", { name: /binh@congty.com/ })).toBeVisible();
  // An invitee belongs to no department yet.
  await userEvent.click(screen.getByRole("button", { name: /Phòng ban/ }));
  await userEvent.click(screen.getByRole("option", { name: "CNTT" }));
  await expect.element(screen.getByRole("row", { name: /binh@congty.com/ })).not.toBeInTheDocument();
});

test("searching and the role filter narrow the invitations too", async () => {
  mockUsers(users, { invitations: [...invitations, { ...invitations[0], id: 8, email: "dung@congty.com", roleId: 4, roleName: "Trưởng phòng" }] });
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("row", { name: /dung@congty.com/ })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: /Vai trò/ }));
  await userEvent.click(screen.getByRole("option", { name: "Nhân viên" }));
  await expect.element(screen.getByRole("row", { name: /dung@congty.com/ })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("row", { name: /binh@congty.com/ })).toBeVisible();
  await userEvent.fill(screen.getByRole("searchbox", { name: "Tìm người dùng" }), "CUONG");
  await expect.element(screen.getByRole("row", { name: /binh@congty.com/ })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("row", { name: /cuong@congty.com/ })).toBeVisible();
});

test("a pending invitation can be sent again or revoked; an expired one only sent again", async () => {
  const requested = mockUsers(users, { invitations });
  const screen = await render(<Harness permissions={[Permissions.Users.View, Permissions.Users.Create]} />);
  await userEvent.click(screen.getByRole("button", { name: "Thao tác · cuong@congty.com" }));
  expect(screen.getByRole("menuitem").elements().map((item) => item.textContent)).toEqual(["Gửi lại"]);
  await userEvent.click(screen.getByRole("menuitem", { name: "Gửi lại" }));
  await vi.waitFor(() => expect(requested).toContain("POST /api/Invitations/6/resend"));
  await expect.element(screen.getByText("Đã gửi lại lời mời tới cuong@congty.com")).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Thao tác · binh@congty.com" }));
  expect(screen.getByRole("menuitem").elements().map((item) => item.textContent)).toEqual(["Gửi lại", "Thu hồi"]);
  await userEvent.click(screen.getByRole("menuitem", { name: "Thu hồi" }));
  const confirm = screen.getByRole("alertdialog", { name: "Thu hồi lời mời?" });
  await userEvent.click(confirm.getByRole("button", { name: "Thu hồi" }));
  await vi.waitFor(() => expect(requested).toContain("POST /api/Invitations/7/revoke"));
  await expect.element(screen.getByText("Đã thu hồi lời mời gửi tới binh@congty.com")).toBeVisible();
  // Both change the list of invitations, which is read again.
  await vi.waitFor(() => expect(requested.filter((path) => path === "/api/Invitations").length).toBeGreaterThanOrEqual(3));
});

test("a refused resend says why and reads the list again: the row was out of date", async () => {
  const requested = mockUsers(users, { invitations, refuseResend: true });
  const screen = await render(<Harness permissions={[Permissions.Users.View, Permissions.Users.Create]} />);
  const listings = () => requested.filter((path) => path === "/api/Invitations").length;
  await expect.element(screen.getByRole("row", { name: /cuong@congty.com/ })).toBeVisible();
  const before = listings();
  await userEvent.click(screen.getByRole("button", { name: "Thao tác · cuong@congty.com" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Gửi lại" }));
  await expect.element(screen.getByText("Lời mời này đã được chấp nhận.")).toBeVisible();
  await vi.waitFor(() => expect(listings()).toBeGreaterThan(before));
});

test("with only Users.View the invitations have no menu", async () => {
  mockUsers(users, { invitations });
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("row", { name: /binh@congty.com/ })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /Thao tác/ })).not.toBeInTheDocument();
});

test("with Users.Create the invite row sits above the list", async () => {
  mockUsers();
  const screen = await render(<Harness permissions={[Permissions.Users.View, Permissions.Users.Create]} />);
  await expect.element(screen.getByRole("heading", { name: "Mời thành viên" })).toBeVisible();
  await expect.element(screen.getByRole("textbox", { name: "Địa chỉ email" })).toBeVisible();
});

test("without Users.Create there is no invite row and no availability request", async () => {
  const requested = mockUsers();
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("row", { name: /Nguyễn Văn An/ })).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Mời thành viên" })).not.toBeInTheDocument();
  expect(requested).not.toContain("/api/Invitations/availability");
});

test("filtering by department, when the viewer may see departments", async () => {
  const requested = mockUsers();
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: /Phòng ban/ }));
  await userEvent.click(screen.getByRole("option", { name: "CNTT" }));
  await vi.waitFor(() => expect(usersRequests(requested).at(-1)).toBe("/api/Users?DepartmentId=3&PageNumber=1&PageSize=10"));
});

test("without Departments.View: no department filter and no departments request", async () => {
  const requested = mockUsers();
  const screen = await render(<Harness permissions={[Permissions.Users.View]} />);
  await expect.element(screen.getByRole("row", { name: /Nguyễn Văn An/ })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /Vai trò/ })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /Phòng ban/ })).not.toBeInTheDocument();
  expect(requested.filter(path => path.startsWith("/api/Departments"))).toEqual([]);
});

test("no one found: the empty notice", async () => {
  mockUsers([]);
  const screen = await render(<Harness />);
  await expect.element(screen.getByText("Không có người dùng nào.")).toBeVisible();
});

test("a failed load offers a retry", async () => {
  const failing = { value: true };
  mockUsers(users, { failing });
  const screen = await render(<Harness />);
  await expect.element(screen.getByText("Không tải được danh sách người dùng.")).toBeVisible();
  failing.value = false;
  await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  await expect.element(screen.getByRole("row", { name: /Nguyễn Văn An/ })).toBeVisible();
});

test("without Users.Create there is no create button", async () => {
  mockUsers();
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("row", { name: /Nguyễn Văn An/ })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Tạo tài khoản" })).not.toBeInTheDocument();
});

test("creating an account shows its temporary password once and refreshes the list", async () => {
  const requested = mockUsers();
  const screen = await render(<Harness permissions={[Permissions.Users.View, Permissions.Users.Create]} />);
  await expect.element(screen.getByRole("row", { name: /Nguyễn Văn An/ })).toBeVisible();
  const listings = () => requested.filter(path => path.startsWith("/api/Users?")).length;
  const before = listings();

  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Họ và tên" }), "Lê Bình");
  await userEvent.tab();
  await expect.element(dialog.getByRole("textbox", { name: "Tên đăng nhập" })).toHaveValue("binh.nv");
  await userEvent.click(dialog.getByRole("button", { name: "Tạo tài khoản", exact: true }));

  // The create dialog gives way to the password dialog, which names the person and shows the password.
  const password = screen.getByRole("dialog", { name: "Mật khẩu tạm của Lê Bình" });
  await expect.element(password.getByText("Abc123xyz456")).toBeVisible();
  // The new account is in the list: it was asked for again.
  await vi.waitFor(() => expect(listings()).toBeGreaterThan(before));

  await userEvent.click(password.getByRole("button", { name: "Xong" }));
  await expect.element(screen.getByText("Abc123xyz456")).not.toBeInTheDocument();
  // Opening the create dialog again starts from an empty form.
  await userEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
  await expect.element(screen.getByRole("dialog").getByRole("textbox", { name: "Họ và tên" })).toHaveValue("");
});

const everyUsersRight = [
  Permissions.Users.View, Permissions.Users.Update, Permissions.Users.ResetPassword, Permissions.Users.Delete, Permissions.Departments.View,
];

test("with only Users.View the table has no actions column and no menu button", async () => {
  mockUsers();
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("row", { name: /Nguyễn Văn An/ })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /Thao tác/ })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("columnheader", { name: "Thao tác" })).not.toBeInTheDocument();
});

test("each row has its menu: the administrator's offers only Sửa, one's own row too", async () => {
  mockUsers();
  const screen = await render(<Harness permissions={everyUsersRight} myId={2} />);
  await expect.element(screen.getByRole("row", { name: /Nguyễn Văn An/ })).toBeVisible();
  // Two rows, two menus.
  await userEvent.click(screen.getByRole("button", { name: /Thao tác · Quản trị/ }));
  expect(screen.getByRole("menuitem").elements().map((item) => item.textContent)).toEqual(["Sửa"]);
  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByRole("menu")).not.toBeInTheDocument();
  // Row 2 is the signed-in person's own: no leaving, deleting or resetting there either.
  await userEvent.click(screen.getByRole("button", { name: /Thao tác · Nguyễn Văn An/ }));
  expect(screen.getByRole("menuitem").elements().map((item) => item.textContent)).toEqual(["Sửa"]);
});

test("deleting a person refreshes the list", async () => {
  const requested = mockUsers();
  const screen = await render(<Harness permissions={everyUsersRight} />);
  await expect.element(screen.getByRole("row", { name: /Nguyễn Văn An/ })).toBeVisible();
  const listings = () => requested.filter(path => path.startsWith("/api/Users?")).length;
  const before = listings();
  await userEvent.click(screen.getByRole("button", { name: /Thao tác · Nguyễn Văn An/ }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Xoá", exact: true }));
  await userEvent.click(screen.getByRole("button", { name: "Xoá", exact: true }));
  await vi.waitFor(() => expect(requested).toContain("DELETE /api/Users/2"));
  await vi.waitFor(() => expect(listings()).toBeGreaterThan(before));
  await expect.element(screen.getByText("Đã xoá tài khoản")).toBeVisible();
});

test("editing a person from the row saves and refreshes the list", async () => {
  const requested = mockUsers();
  const screen = await render(<Harness permissions={everyUsersRight} />);
  await expect.element(screen.getByRole("row", { name: /Nguyễn Văn An/ })).toBeVisible();
  const listings = () => requested.filter(path => path.startsWith("/api/Users?")).length;
  const before = listings();
  await userEvent.click(screen.getByRole("button", { name: /Thao tác · Nguyễn Văn An/ }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Sửa" }));
  // Typing in a dialog opened from a table cell must reach its field (the table's keyboard handling stays out of it).
  const name = screen.getByRole("dialog").getByRole("textbox", { name: "Họ và tên" });
  await userEvent.fill(name, "Nguyễn Văn Bình");
  await expect.element(name).toHaveValue("Nguyễn Văn Bình");
  await userEvent.click(screen.getByRole("button", { name: "Lưu", exact: true }));
  await vi.waitFor(() => expect(requested).toContain("PUT /api/Users/2"));
  await vi.waitFor(() => expect(listings()).toBeGreaterThan(before));
});

test("the temporary password stays on screen while the refreshed list arrives", async () => {
  const requested = mockUsers();
  const screen = await render(<Harness permissions={everyUsersRight} />);
  await expect.element(screen.getByRole("row", { name: /Nguyễn Văn An/ })).toBeVisible();
  const listings = () => requested.filter(path => path.startsWith("/api/Users?")).length;
  const before = listings();
  await userEvent.click(screen.getByRole("button", { name: /Thao tác · Nguyễn Văn An/ }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Đặt lại mật khẩu" }));
  await userEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu", exact: true }));
  await vi.waitFor(() => expect(listings()).toBeGreaterThan(before));
  await expect.element(screen.getByRole("dialog", { name: "Mật khẩu tạm của Nguyễn Văn An" }).getByText("Xyz234abc567")).toBeVisible();
});
