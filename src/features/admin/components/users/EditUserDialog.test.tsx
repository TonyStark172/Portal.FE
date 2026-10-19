import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { Toast, toast } from "@heroui/react";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type DepartmentDto, type PositionDto, type RoleDto, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { EditUserDialog } from "./EditUserDialog";

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

const roles: RoleDto[] = [
  { id: 1, name: "Administrator", description: null, isAdmin: true, isDefault: false, permissions: [], userCount: 1 },
  { id: 2, name: "Nhân viên", description: null, isAdmin: false, isDefault: true, permissions: [], userCount: 5 },
  { id: 3, name: "Kế toán", description: null, isAdmin: false, isDefault: false, permissions: [], userCount: 2 },
];
// Only the active ones are asked for, so the inactive department 4 below is not in this list.
const departments: DepartmentDto[] = [
  { id: 3, code: "IT", name: "CNTT", originalName: "CNTT", parentId: null, parentName: null, isActive: true },
  { id: 7, code: "BIZ", name: "Kinh doanh", originalName: "Kinh doanh", parentId: null, parentName: null, isActive: true },
];
const positions: PositionDto[] = [
  { id: 5, code: "SPEC", name: "Chuyên viên", originalName: "Chuyên viên", level: 5, isActive: true },
  { id: 8, code: "LEAD", name: "Trưởng nhóm", originalName: "Trưởng nhóm", level: 4, isActive: true },
];

/** A staff member with a primary assignment and a concurrent one (department 4, position 6, both inactive now). */
const staff: UserDto = {
  id: 2, fullName: "Nguyễn Văn An", userName: "an.nv", phoneNumber: "0901234567", employeeCode: "NV001", joinedOn: "2024-03-01",
  emailConfirmed: true, isAdministrator: false, isActive: true, mustChangePassword: false,
  roles: [{ id: 2, name: "Nhân viên" }],
  assignments: [
    { departmentId: 3, departmentName: "CNTT", positionId: 5, positionName: "Chuyên viên", positionLevel: 5, role: "Member", isPrimary: true },
    { departmentId: 4, departmentName: "Phòng cũ", positionId: 6, positionName: "Chức vụ cũ", positionLevel: 6, role: "Member", isPrimary: false },
  ],
};
const administrator: UserDto = {
  id: 1, fullName: "Quản trị", userName: "admin", emailConfirmed: true, isAdministrator: true, isActive: true, mustChangePassword: false,
  roles: [{ id: 1, name: "Administrator" }, { id: 3, name: "Kế toán" }], assignments: [],
};

type Write = { method: string; path: string; body: unknown };
/** Answers departments, positions and roles, and `PUT /api/Users/{id}` with `reply`; returns the writes. */
function mockApi(reply: (write: Write) => Response = () => new Response(null, { status: 204 })) {
  const writes: Write[] = [];
  const requested: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withRequest((url, init) => {
    const { pathname, search } = new URL(url);
    const path = pathname.replace(/^.*?(?=\/api\/)/, "");
    requested.push(path + search);
    if (path === "/api/Departments") return Response.json(departments);
    if (path === "/api/Positions") return Response.json(positions);
    if (path === "/api/Roles") return Response.json(roles);
    if (path === "/api/Auth/me") return Response.json({ user: { id: 9, fullName: "Quản lý", isAdministrator: false }, permissions: everyRight });
    if (path.startsWith("/api/Users/") && init.method === "PUT") {
      const write = { method: init.method, path: path + search, body: JSON.parse(init.body ?? "null") };
      writes.push(write);
      return reply(write);
    }
    return Response.json({});
  }));
  return { writes, requested };
}

const everyRight = [Permissions.Users.View, Permissions.Users.Update, Permissions.Departments.View, Permissions.Positions.View];

function Harness({ user = staff, isAdministrator = false, permissions = everyRight, onOpenChange = () => {} }: {
  user?: UserDto;
  isAdministrator?: boolean;
  permissions?: string[];
  onOpenChange?: (open: boolean) => void;
}) {
  // One store per test: RTK Query keeps what it read, which must not leak from one test into the next.
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 9, fullName: "Quản lý", isAdministrator } as UserDto,
      permissions,
    }));
    // The roles are already known to the page the dialog opens from.
    void own.dispatch(portalApi.util.upsertQueryData("getRoles", undefined, roles));
    return own;
  });
  return (
    <Provider store={store}>
      <Toast.Provider />
      <EditUserDialog user={user} isOpen onOpenChange={onOpenChange} />
    </Provider>
  );
}

const save = (screen: Awaited<ReturnType<typeof render>>) => userEvent.click(screen.getByRole("button", { name: "Lưu", exact: true }));

test("someone who is not the administrator edits details and keeps the roles", async () => {
  const { writes } = mockApi();
  const onOpenChange = vi.fn();
  // Two roles, to show the very same ones go back (the editor cannot change them).
  const screen = await render(<Harness user={{ ...staff, roles: [{ id: 2, name: "Nhân viên" }, { id: 3, name: "Kế toán" }] }} onOpenChange={onOpenChange} />);
  await expect.element(screen.getByRole("button", { name: /Vai trò/ })).not.toBeInTheDocument();
  const name = screen.getByRole("textbox", { name: "Họ và tên" });
  await expect.element(name).toHaveValue("Nguyễn Văn An");
  await userEvent.fill(name, "  Nguyễn Văn Bình  ");
  await save(screen);
  await vi.waitFor(() => expect(writes).toEqual([
    {
      method: "PUT", path: "/api/Users/2",
      body: {
        fullName: "Nguyễn Văn Bình", phoneNumber: "0901234567", employeeCode: "NV001", joinedOn: "2024-03-01",
        // The primary assignment as it was, then the concurrent one, untouched.
        assignments: [
          { departmentId: 3, positionId: 5, isPrimary: true },
          { departmentId: 4, positionId: 6, isPrimary: false },
        ],
        roleIds: [2, 3],
      },
    },
  ]));
  await expect.element(screen.getByText("Đã lưu")).toBeVisible();
  await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});

test("the administrator changes roles", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness isAdministrator />);
  const select = screen.getByRole("button", { name: /Vai trò/ });
  await expect.element(select).toHaveTextContent("Nhân viên");
  await userEvent.click(select);
  // The administrator's role is never offered.
  await expect.element(screen.getByRole("option", { name: "Administrator" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("option", { name: "Kế toán" }));
  await userEvent.keyboard("{Escape}");
  await save(screen);
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({ roleIds: [2, 3] });
});

test("on the administrator's own row their role is shown fixed and always sent", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness user={administrator} isAdministrator />);
  await expect.element(screen.getByText("Administrator")).toBeVisible();
  // The select holds the other role; the fixed one is not an option, so it cannot be removed.
  const select = screen.getByRole("button", { name: /Vai trò/ });
  await expect.element(select).toHaveTextContent("Kế toán");
  await userEvent.click(select);
  await expect.element(screen.getByRole("option", { name: "Administrator" })).not.toBeInTheDocument();
  // Taking the other role away leaves the fixed one.
  await userEvent.click(screen.getByRole("option", { name: "Kế toán" }));
  await userEvent.keyboard("{Escape}");
  await save(screen);
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({ roleIds: [1] });
});

test("the primary assignment can be changed; the concurrent one is kept", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("button", { name: /Phòng ban/ })).toHaveTextContent("CNTT");
  await expect.element(screen.getByRole("button", { name: /Chức vụ/ })).toHaveTextContent("Chuyên viên");
  await userEvent.click(screen.getByRole("button", { name: /Phòng ban/ }));
  await userEvent.click(screen.getByRole("option", { name: "Kinh doanh" }));
  await userEvent.click(screen.getByRole("button", { name: /Chức vụ/ }));
  await userEvent.click(screen.getByRole("option", { name: "Trưởng nhóm" }));
  await save(screen);
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({
    assignments: [
      { departmentId: 7, positionId: 8, isPrimary: true },
      { departmentId: 4, positionId: 6, isPrimary: false },
    ],
  });
});

test("a primary assignment whose department is no longer active stays shown and is sent back as it was", async () => {
  const { writes } = mockApi();
  const inactive: UserDto = {
    ...staff,
    assignments: [{ departmentId: 4, departmentName: "Phòng cũ", positionId: 6, positionName: "Chức vụ cũ", positionLevel: 6, role: "Member", isPrimary: true }],
  };
  const screen = await render(<Harness user={inactive} />);
  await expect.element(screen.getByRole("button", { name: /Phòng ban/ })).toHaveTextContent("Phòng cũ");
  await expect.element(screen.getByRole("button", { name: /Chức vụ/ })).toHaveTextContent("Chức vụ cũ");
  await save(screen);
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({ assignments: [{ departmentId: 4, positionId: 6, isPrimary: true }] });
});

test("emptied optional fields are sent as null", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await userEvent.fill(screen.getByRole("textbox", { name: "Số điện thoại" }), "");
  await userEvent.fill(screen.getByRole("textbox", { name: "Mã nhân sự" }), "  ");
  await userEvent.fill(screen.getByLabelText("Ngày vào làm"), "");
  await save(screen);
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({ phoneNumber: null, employeeCode: null, joinedOn: null });
});

test("without the right to see departments and positions the assignments go back as they were", async () => {
  const { writes, requested } = mockApi();
  const screen = await render(<Harness permissions={[Permissions.Users.View, Permissions.Users.Update]} />);
  await expect.element(screen.getByRole("textbox", { name: "Họ và tên" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /Phòng ban/ })).not.toBeInTheDocument();
  await save(screen);
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({
    assignments: [
      { departmentId: 3, positionId: 5, isPrimary: true },
      { departmentId: 4, positionId: 6, isPrimary: false },
    ],
  });
  expect(requested.filter(path => path.startsWith("/api/Departments") || path.startsWith("/api/Positions"))).toEqual([]);
});

test("a department without a position is sent with no position", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: /Chức vụ/ }));
  await userEvent.click(screen.getByRole("option", { name: "Chưa phân công" }));
  await save(screen);
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({
    assignments: [
      { departmentId: 3, positionId: null, isPrimary: true },
      { departmentId: 4, positionId: 6, isPrimary: false },
    ],
  });
});

test("a position without a department is not sent", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: /Phòng ban/ }));
  await userEvent.click(screen.getByRole("option", { name: "Chưa phân công" }));
  await save(screen);
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Chọn phòng ban cho chức vụ này, hoặc để trống chức vụ.");
  expect(writes).toEqual([]);
});

test("a validation error shows on its field and the dialog stays open", async () => {
  mockApi(() => Response.json({
    status: 400, code: "validation_failed", detail: "Vui lòng kiểm tra lại các trường được báo lỗi.",
    errors: { EmployeeCode: ["Mã nhân sự 'NV001' đã tồn tại."] },
  }, { status: 400 }));
  const onOpenChange = vi.fn();
  const screen = await render(<Harness onOpenChange={onOpenChange} />);
  await save(screen);
  await expect.element(screen.getByText("Mã nhân sự 'NV001' đã tồn tại.")).toBeVisible();
  expect(onOpenChange).not.toHaveBeenCalled();
});

test("any other refusal is reported in a toast and the dialog stays open", async () => {
  mockApi(() => Response.json({ status: 403, code: "forbidden", detail: "Bạn không được cấp vai trò này." }, { status: 403 }));
  const onOpenChange = vi.fn();
  const screen = await render(<Harness onOpenChange={onOpenChange} />);
  await save(screen);
  await expect.element(screen.getByText("Bạn không được cấp vai trò này.")).toBeVisible();
  expect(onOpenChange).not.toHaveBeenCalled();
});

test("a refusal without a message says something went wrong", async () => {
  mockApi(() => new Response(null, { status: 500 }));
  const screen = await render(<Harness />);
  await save(screen);
  await expect.element(screen.getByText("Đã có lỗi xảy ra. Vui lòng thử lại.")).toBeVisible();
});

test("editing oneself refreshes the signed-in profile, editing someone else does not", async () => {
  const { requested } = mockApi();
  const own = await render(<Harness user={{ ...staff, id: 9 }} />);
  await save(own);
  await vi.waitFor(() => expect(requested).toContain("/api/Auth/me"));
  await own.unmount();

  requested.length = 0;
  const other = await render(<Harness />);
  await save(other);
  await expect.element(other.getByText("Đã lưu")).toBeVisible();
  expect(requested).not.toContain("/api/Auth/me");
});

test("clearing the primary assignment while there are concurrent ones is blocked, nothing is sent", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: /Phòng ban/ }));
  await userEvent.click(screen.getByRole("option", { name: "Chưa phân công" }));
  // The first list closes before the second opens (both have a "not assigned" option).
  await expect.element(screen.getByRole("option")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /Chức vụ/ }));
  await userEvent.click(screen.getByRole("option", { name: "Chưa phân công" }));
  await expect.element(screen.getByRole("option")).not.toBeInTheDocument();
  await save(screen);
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Cần chọn phòng ban chính khi người này còn kiêm nhiệm.");
  expect(writes).toEqual([]);
});

test("a primary assignment equal to a concurrent one is blocked, nothing is sent", async () => {
  const { writes } = mockApi();
  // Primary 7/8, concurrent 3/5: choosing 3/5 as the primary would repeat it.
  const user: UserDto = {
    ...staff,
    assignments: [
      { departmentId: 7, departmentName: "Kinh doanh", positionId: 8, positionName: "Trưởng nhóm", positionLevel: 4, role: "Member", isPrimary: true },
      { departmentId: 3, departmentName: "CNTT", positionId: 5, positionName: "Chuyên viên", positionLevel: 5, role: "Member", isPrimary: false },
    ],
  };
  const screen = await render(<Harness user={user} />);
  await userEvent.click(screen.getByRole("button", { name: /Phòng ban/ }));
  await userEvent.click(screen.getByRole("option", { name: "CNTT" }));
  await userEvent.click(screen.getByRole("button", { name: /Chức vụ/ }));
  await userEvent.click(screen.getByRole("option", { name: "Chuyên viên" }));
  await save(screen);
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Phòng ban chính trùng với một phòng ban kiêm nhiệm.");
  expect(writes).toEqual([]);
});

test("a server error on the assignments shows under the assignment fields", async () => {
  mockApi(() => Response.json({
    status: 400, code: "validation_failed", detail: "Vui lòng kiểm tra lại các trường được báo lỗi.",
    errors: { Assignments: ["Có vị trí (phòng ban + chức danh) bị chọn lặp lại."] },
  }, { status: 400 }));
  const screen = await render(<Harness />);
  await save(screen);
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Có vị trí (phòng ban + chức danh) bị chọn lặp lại.");
  await expect.element(screen.getByText("Vui lòng kiểm tra lại các trường được báo lỗi.")).not.toBeInTheDocument();
});

test("a server error on a key no field shows is reported with its own message, not the generic one", async () => {
  mockApi(() => Response.json({
    status: 400, code: "validation_failed", detail: "Vui lòng kiểm tra lại các trường được báo lỗi.",
    errors: { RoleIds: ["Có vai trò không tồn tại."] },
  }, { status: 400 }));
  const screen = await render(<Harness isAdministrator />);
  await save(screen);
  await expect.element(screen.getByText("Có vai trò không tồn tại.")).toBeVisible();
  await expect.element(screen.getByText("Vui lòng kiểm tra lại các trường được báo lỗi.")).not.toBeInTheDocument();
});

test("without the assignment fields, an error on the assignments is reported as a message", async () => {
  mockApi(() => Response.json({
    status: 400, code: "validation_failed", detail: "Vui lòng kiểm tra lại các trường được báo lỗi.",
    errors: { Assignments: ["Phải chọn đúng một vị trí chính."] },
  }, { status: 400 }));
  const screen = await render(<Harness permissions={[Permissions.Users.View, Permissions.Users.Update]} />);
  await save(screen);
  await expect.element(screen.getByText("Phải chọn đúng một vị trí chính.")).toBeVisible();
});
