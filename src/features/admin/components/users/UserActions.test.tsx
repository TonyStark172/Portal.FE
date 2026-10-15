import "@/app/globals.css";
import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { Toast, toast } from "@heroui/react";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type DepartmentDto, type PositionDto, type RoleDto, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { todayAsDateInput } from "../../lib/dates";
import { UserActions } from "./UserActions";

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
];
const departments: DepartmentDto[] = [
  { id: 3, code: "IT", name: "CNTT", originalName: "CNTT", parentId: null, parentName: null, isActive: true, memberCount: 0, childCount: 0, canDelete: true },
];
const positions: PositionDto[] = [
  { id: 5, code: "SPEC", name: "Chuyên viên", originalName: "Chuyên viên", level: 5, isActive: true, holderCount: 0, canDelete: true },
];

const staff: UserDto = {
  id: 2, fullName: "Nguyễn Văn An", userName: "an.nv", emailConfirmed: true, isAdministrator: false, isActive: true,
  mustChangePassword: false, roles: [{ id: 2, name: "Nhân viên" }],
  assignments: [{ departmentId: 3, departmentName: "CNTT", positionId: 5, positionName: "Chuyên viên", positionLevel: 5, isPrimary: true }],
};
const administrator: UserDto = {
  id: 1, fullName: "Quản trị", userName: "admin", emailConfirmed: true, isAdministrator: true, isActive: true,
  mustChangePassword: false, roles: [{ id: 1, name: "Administrator" }], assignments: [],
};
const left: UserDto = { ...staff, isActive: false };

type Write = { method: string; path: string; body: string };
/** Answers what the dialogs read, and every other write with `reply` (default: 204); returns the writes. */
function mockApi(reply: (write: Write) => Response | Promise<Response> = () => new Response(null, { status: 204 })) {
  const writes: Write[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withRequest((url, init) => {
    const { pathname, search } = new URL(url);
    const path = pathname.replace(/^.*?(?=\/api\/)/, "");
    if (path === "/api/Departments") return Response.json(departments);
    if (path === "/api/Positions") return Response.json(positions);
    if (path === "/api/Roles") return Response.json(roles);
    if (init.method === "GET") return Response.json({});
    const write = { method: init.method, path: path + search, body: init.body ?? "" };
    writes.push(write);
    return reply(write);
  }));
  return { writes };
}

const everyUsersRight = [Permissions.Users.View, Permissions.Users.Update, Permissions.Users.ResetPassword, Permissions.Users.Delete];

function Harness({ user = staff, permissions = everyUsersRight, myId = 9, onStore }: {
  user?: UserDto;
  permissions?: string[];
  /** Whose menu it is: the person signed in (the row is "one's own" when it is the same person). */
  myId?: number;
  /** Hands the test the store, to look at what RTK Query kept. */
  onStore?: (store: ReturnType<typeof makeStore>) => void;
}) {
  // One store per test: RTK Query keeps what it read, which must not leak from one test into the next.
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: myId, fullName: "Quản lý", isAdministrator: false } as UserDto,
      permissions: [...permissions, Permissions.Departments.View, Permissions.Positions.View],
    }));
    void own.dispatch(portalApi.util.upsertQueryData("getRoles", undefined, roles));
    return own;
  });
  useEffect(() => onStore?.(store), [onStore, store]);
  return (
    <Provider store={store}>
      <Toast.Provider />
      <UserActions user={user} />
    </Provider>
  );
}

const menuButton = (screen: Awaited<ReturnType<typeof render>>) => screen.getByRole("button", { name: /Thao tác/ });

/** The names of the items of the open menu, in order. */
async function openMenu(screen: Awaited<ReturnType<typeof render>>) {
  await userEvent.click(menuButton(screen));
  await expect.element(screen.getByRole("menu")).toBeVisible();
  return screen.getByRole("menuitem").elements().map((item) => item.textContent);
}

test("with only the right to view users there is no menu at all", async () => {
  const screen = await render(<Harness permissions={[Permissions.Users.View]} />);
  await expect.element(menuButton(screen)).not.toBeInTheDocument();
});

test("the menu offers what one may do", async () => {
  mockApi();
  const screen = await render(<Harness />);
  expect(await openMenu(screen)).toEqual(["Sửa", "Đặt lại mật khẩu", "Cho nghỉ việc", "Xoá"]);
});

test("on the administrator's row only Sửa is offered", async () => {
  const screen = await render(<Harness user={administrator} />);
  expect(await openMenu(screen)).toEqual(["Sửa"]);
});

test("on one's own row nothing that the server refuses is offered", async () => {
  const screen = await render(<Harness myId={2} />);
  expect(await openMenu(screen)).toEqual(["Sửa"]);
});

test("someone who left may be taken back, and there is no leaving again", async () => {
  const screen = await render(<Harness user={left} />);
  expect(await openMenu(screen)).toEqual(["Sửa", "Đặt lại mật khẩu", "Nhận lại", "Xoá"]);
});

test("each item needs its own right", async () => {
  const resetOnly = await render(<Harness permissions={[Permissions.Users.View, Permissions.Users.ResetPassword]} />);
  expect(await openMenu(resetOnly)).toEqual(["Đặt lại mật khẩu"]);
  await resetOnly.unmount();

  const updateOnly = await render(<Harness permissions={[Permissions.Users.View, Permissions.Users.Update]} />);
  expect(await openMenu(updateOnly)).toEqual(["Sửa", "Cho nghỉ việc"]);
  await updateOnly.unmount();

  const deleteOnly = await render(<Harness permissions={[Permissions.Users.View, Permissions.Users.Delete]} />);
  expect(await openMenu(deleteOnly)).toEqual(["Xoá"]);
});

test("Sửa opens the edit dialog", async () => {
  mockApi();
  const screen = await render(<Harness />);
  await openMenu(screen);
  await userEvent.click(screen.getByRole("menuitem", { name: "Sửa" }));
  const dialog = screen.getByRole("dialog", { name: "Sửa tài khoản của Nguyễn Văn An" });
  await expect.element(dialog.getByRole("textbox", { name: "Họ và tên" })).toHaveValue("Nguyễn Văn An");
});

test("resetting shows the new temporary password", async () => {
  const { writes } = mockApi(() => Response.json({ temporaryPassword: "Xyz234abc567" }));
  const screen = await render(<Harness />);
  await openMenu(screen);
  await userEvent.click(screen.getByRole("menuitem", { name: "Đặt lại mật khẩu" }));
  await expect.element(screen.getByText("Cấp mật khẩu tạm mới cho Nguyễn Văn An? Người đó sẽ bị đăng xuất khỏi mọi thiết bị.")).toBeVisible();
  expect(writes).toEqual([]);
  await userEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu", exact: true }));

  // The request has no body; its answer is shown in the password dialog, once.
  const dialog = screen.getByRole("dialog", { name: "Mật khẩu tạm của Nguyễn Văn An" });
  await expect.element(dialog.getByText("Xyz234abc567")).toBeVisible();
  expect(writes).toEqual([{ method: "PUT", path: "/api/Users/2/password", body: "" }]);

  await userEvent.click(dialog.getByRole("button", { name: "Xong" }));
  await expect.element(screen.getByText("Xyz234abc567")).not.toBeInTheDocument();
});

test("the temporary password is not left in the request state", async () => {
  mockApi(() => Response.json({ temporaryPassword: "Xyz234abc567" }));
  let store: ReturnType<typeof makeStore> | undefined;
  const screen = await render(<Harness onStore={own => { store = own; }} />);
  await openMenu(screen);
  await userEvent.click(screen.getByRole("menuitem", { name: "Đặt lại mật khẩu" }));
  await userEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu", exact: true }));
  // It is on screen (so the mutation did finish and hand it over)...
  await expect.element(screen.getByText("Xyz234abc567")).toBeVisible();
  // ...and nowhere in what RTK Query keeps, while the dialog that shows it is still open.
  await vi.waitFor(() => expect(JSON.stringify(store!.getState().api.mutations)).not.toContain("Xyz234abc567"));
});

test("a refused reset is reported and shows no password", async () => {
  mockApi(() => Response.json({ status: 409, code: "conflict", detail: "Không thể đặt lại mật khẩu của quản trị viên." }, { status: 409 }));
  const screen = await render(<Harness />);
  await openMenu(screen);
  await userEvent.click(screen.getByRole("menuitem", { name: "Đặt lại mật khẩu" }));
  await userEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu", exact: true }));
  await expect.element(screen.getByText("Không thể đặt lại mật khẩu của quản trị viên.")).toBeVisible();
  await expect.element(screen.getByRole("dialog", { name: "Mật khẩu tạm của Nguyễn Văn An" })).not.toBeInTheDocument();
});

test("letting someone leave sends the last day", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await openMenu(screen);
  await userEvent.click(screen.getByRole("menuitem", { name: "Cho nghỉ việc" }));
  const dialog = screen.getByRole("dialog", { name: "Cho Nguyễn Văn An nghỉ việc" });
  // The last day starts as today, in the user's own time zone.
  const day = dialog.getByLabelText("Ngày làm việc cuối");
  await expect.element(day).toHaveValue(todayAsDateInput());
  await userEvent.fill(day, "2026-10-15");
  await userEvent.click(dialog.getByRole("button", { name: "Cho nghỉ việc", exact: true }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "PUT", path: "/api/Users/2/deactivate", body: JSON.stringify({ leftOn: "2026-10-15" }) },
  ]));
  await expect.element(screen.getByText("Đã cho nghỉ việc")).toBeVisible();
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
});

test("taking someone back sends the rejoining day", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness user={left} />);
  await openMenu(screen);
  await userEvent.click(screen.getByRole("menuitem", { name: "Nhận lại" }));
  const dialog = screen.getByRole("dialog", { name: "Nhận Nguyễn Văn An quay lại" });
  const day = dialog.getByLabelText("Ngày quay lại");
  await expect.element(day).toHaveValue(todayAsDateInput());
  await userEvent.fill(day, "2026-11-02");
  await userEvent.click(dialog.getByRole("button", { name: "Nhận lại", exact: true }));
  await vi.waitFor(() => expect(writes).toEqual([
    { method: "PUT", path: "/api/Users/2/reactivate", body: JSON.stringify({ rejoinedOn: "2026-11-02" }) },
  ]));
  await expect.element(screen.getByText("Đã nhận lại")).toBeVisible();
});

test("a refused leave is reported and the dialog stays for another day", async () => {
  mockApi(() => Response.json({ status: 400, code: "bad_request", detail: "Ngày nghỉ việc không được trước ngày vào làm." }, { status: 400 }));
  const screen = await render(<Harness />);
  await openMenu(screen);
  await userEvent.click(screen.getByRole("menuitem", { name: "Cho nghỉ việc" }));
  const dialog = screen.getByRole("dialog", { name: "Cho Nguyễn Văn An nghỉ việc" });
  await userEvent.click(dialog.getByRole("button", { name: "Cho nghỉ việc", exact: true }));
  await expect.element(screen.getByText("Ngày nghỉ việc không được trước ngày vào làm.")).toBeVisible();
  await expect.element(dialog).toBeVisible();
});

test("deleting asks first, then deletes", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await openMenu(screen);
  await userEvent.click(screen.getByRole("menuitem", { name: "Xoá", exact: true }));
  await expect.element(screen.getByText("Xoá tài khoản của Nguyễn Văn An? Không thể hoàn tác.")).toBeVisible();
  expect(writes).toEqual([]);
  await userEvent.click(screen.getByRole("button", { name: "Xoá", exact: true }));
  await vi.waitFor(() => expect(writes).toEqual([{ method: "DELETE", path: "/api/Users/2", body: "" }]));
  await expect.element(screen.getByText("Đã xoá tài khoản")).toBeVisible();
});

test("cancelling the deletion sends nothing", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await openMenu(screen);
  await userEvent.click(screen.getByRole("menuitem", { name: "Xoá", exact: true }));
  await userEvent.click(screen.getByRole("button", { name: "Huỷ" }));
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  expect(writes).toEqual([]);
});

test("a refusal is reported", async () => {
  mockApi(() => Response.json({
    status: 409, code: "conflict", detail: "Không thể xoá quản trị viên. Hãy chuyển giao quyền quản trị trước.",
  }, { status: 409 }));
  const screen = await render(<Harness />);
  await openMenu(screen);
  await userEvent.click(screen.getByRole("menuitem", { name: "Xoá", exact: true }));
  await userEvent.click(screen.getByRole("button", { name: "Xoá", exact: true }));
  await expect.element(screen.getByText("Không thể xoá quản trị viên. Hãy chuyển giao quyền quản trị trước.")).toBeVisible();
});

test("a refusal without a message says something went wrong", async () => {
  mockApi(() => new Response(null, { status: 500 }));
  const screen = await render(<Harness />);
  await openMenu(screen);
  await userEvent.click(screen.getByRole("menuitem", { name: "Xoá", exact: true }));
  await userEvent.click(screen.getByRole("button", { name: "Xoá", exact: true }));
  await expect.element(screen.getByText("Đã có lỗi xảy ra. Vui lòng thử lại.")).toBeVisible();
});

test("a refusal of the day itself shows under the field; any other key is told as it is", async () => {
  mockApi(() => Response.json({
    status: 400, code: "validation_failed", detail: "Vui lòng kiểm tra lại các trường được báo lỗi.",
    errors: { LeftOn: ["Ngày nghỉ việc không được trước ngày vào làm."], Id: ["Mã không hợp lệ."] },
  }, { status: 400 }));
  const screen = await render(<Harness />);
  await openMenu(screen);
  await userEvent.click(screen.getByRole("menuitem", { name: "Cho nghỉ việc" }));
  const dialog = screen.getByRole("dialog", { name: "Cho Nguyễn Văn An nghỉ việc" });
  await userEvent.click(dialog.getByRole("button", { name: "Cho nghỉ việc", exact: true }));
  await expect.element(dialog.getByText("Ngày nghỉ việc không được trước ngày vào làm.")).toBeVisible();
  await expect.element(screen.getByText("Mã không hợp lệ.")).toBeVisible();
  await expect.element(screen.getByText("Vui lòng kiểm tra lại các trường được báo lỗi.")).not.toBeInTheDocument();
});

test("while a delete is on its way, Huỷ and Escape cannot dismiss the question", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const { writes } = mockApi(async () => {
    await gate;
    return new Response(null, { status: 204 });
  });
  const screen = await render(<Harness />);
  await openMenu(screen);
  await userEvent.click(screen.getByRole("menuitem", { name: "Xoá", exact: true }));
  await userEvent.click(screen.getByRole("button", { name: "Xoá", exact: true }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  // The request is pending: nobody can say "no" any more, and the dialog stays until it is answered.
  await expect.element(screen.getByRole("button", { name: "Huỷ" })).toBeDisabled();
  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByRole("alertdialog")).toBeVisible();
  release();
  await expect.element(screen.getByText("Đã xoá tài khoản")).toBeVisible();
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
});

test("while a reset is on its way, Huỷ and Escape cannot dismiss the question", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const { writes } = mockApi(async () => {
    await gate;
    return Response.json({ temporaryPassword: "Xyz234abc567" });
  });
  const screen = await render(<Harness />);
  await openMenu(screen);
  await userEvent.click(screen.getByRole("menuitem", { name: "Đặt lại mật khẩu" }));
  await userEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu", exact: true }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  await expect.element(screen.getByRole("button", { name: "Huỷ" })).toBeDisabled();
  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByRole("alertdialog")).toBeVisible();
  release();
  await expect.element(screen.getByText("Xyz234abc567")).toBeVisible();
});
