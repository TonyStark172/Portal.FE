import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type DepartmentChartNode, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { DepartmentWizard } from "./DepartmentWizard";

afterEach(() => vi.restoreAllMocks());

/** Hands a mocked fetch what RTK Query sent (it passes a Request). */
const withRequest = (handler: (url: string, init: { method: string; body: string | null }) => Promise<Response> | Response) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    return handler(request.url, { method: request.method, body: ["GET", "HEAD"].includes(request.method) ? null : await request.clone().text() });
  };

const node = (fields: Partial<DepartmentChartNode> & Pick<DepartmentChartNode, "id" | "name">): DepartmentChartNode => ({
  code: `D${fields.id}`, originalName: fields.name, description: null, parentId: null, isActive: true,
  memberCount: 0, childCount: 0, headCount: 0, heads: [], ...fields,
});

const nodes: DepartmentChartNode[] = [
  node({ id: 1, name: "Ban Giám đốc", childCount: 2 }),
  node({ id: 2, name: "Phòng Kỹ thuật", originalName: "Kỹ thuật (gốc)", code: "KTH", description: "Làm kỹ thuật", parentId: 1, childCount: 1, memberCount: 7 }),
  node({ id: 3, name: "Tổ Mạng", parentId: 2 }),
  node({ id: 4, name: "Phòng cũ", parentId: 1, isActive: false }),
];

const people = [
  { id: 7, userName: "hung.tv", fullName: "Trần Văn Hùng", isActive: true },
  { id: 9, userName: "mai.lt", fullName: "Lê Thị Mai", isActive: true },
];
const page = (items: unknown[]) => ({ items, pageNumber: 1, totalPages: 1, totalCount: items.length, hasPreviousPage: false, hasNextPage: false });
const member = (userId: number, fullName: string, role: string) => ({ userId, userName: `u${userId}`, fullName, positionId: null, positionName: null, isPrimary: true, role, avatarUrl: null });

type Write = { method: string; path: string; body: unknown };

/** Answers the people list and the current heads and deputies of department 2; records the writes and answers them with `reply`. */
function mockApi(
  reply: (write: Write) => Response = () => Response.json(5, { status: 201 }),
  /** Holds back the answers about the current heads and deputies until it resolves. */
  gate?: Promise<unknown>,
  /** The head list claims there is a second page. */
  moreHeads = false,
) {
  const writes: Write[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withRequest((url, init) => {
    const { pathname, searchParams } = new URL(url);
    const path = pathname.replace(/^.*?(?=\/api\/)/, "");
    if (init.method !== "GET") {
      const write = { method: init.method, path, body: JSON.parse(init.body ?? "null") };
      writes.push(write);
      return reply(write);
    }
    if (path === "/api/Users") return Response.json(page(people));
    if (path === "/api/Departments/2/members") {
      const role = searchParams.get("role");
      const body = page(role === "Head" ? [member(11, "Phạm An", "Head")] : role === "Deputy" ? [member(12, "Đỗ Bình", "Deputy")] : []);
      if (moreHeads && role === "Head") body.hasNextPage = true;
      return gate ? gate.then(() => Response.json(body)) : Response.json(body);
    }
    return Response.json({});
  }));
  return writes;
}

function Harness({ mode = "create", department, parentId = null, onClose = () => {}, onSaved = () => {} }: {
  mode?: "create" | "edit";
  department?: DepartmentChartNode;
  parentId?: number | null;
  onClose?: () => void;
  onSaved?: (id: number) => void;
}) {
  // One store per test: RTK Query keeps what it read, which must not leak from one test into the next.
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 9, fullName: "Quản lý", isAdministrator: false } as UserDto,
      permissions: [Permissions.Users.View, Permissions.Departments.View, Permissions.Departments.Create, Permissions.Departments.Update],
    }));
    return own;
  });
  return (
    <Provider store={store}>
      <DepartmentWizard mode={mode} department={department} parentId={parentId} nodes={nodes} organizationName="Báo Tuổi Trẻ" onClose={onClose} onSaved={onSaved} />
    </Provider>
  );
}

type Screen = Awaited<ReturnType<typeof render>>;
const typeName = (screen: Screen, name: string) => userEvent.fill(screen.getByRole("textbox", { name: "Tên phòng ban" }), name);
const picker = (screen: Screen, name: string) => screen.getByRole("group", { name, exact: true });

test("the code follows the name until edited", async () => {
  mockApi();
  const screen = await render(<Harness />);
  const code = screen.getByRole("textbox", { name: "Mã phòng ban" });
  await typeName(screen, "Kế toán");
  await expect.element(code).toHaveValue("KT");
  await typeName(screen, "Kế toán tổng hợp");
  await expect.element(code).toHaveValue("KTTH");
  // Once typed by hand, the code stays.
  await userEvent.fill(code, "ACC");
  await typeName(screen, "Phòng Kế toán");
  await expect.element(code).toHaveValue("ACC");
});

test("creating with staff posts one request", async () => {
  const writes = mockApi();
  const onSaved = vi.fn();
  const screen = await render(<Harness parentId={1} onSaved={onSaved} />);
  await typeName(screen, "Kế toán");
  await screen.getByRole("button", { name: "Tiếp" }).click();
  await picker(screen, "Trưởng phòng").getByRole("button", { name: /Trần Văn Hùng/ }).click();
  await picker(screen, "Nhân viên").getByRole("button", { name: /Lê Thị Mai/ }).click();
  await expect.element(screen.getByRole("radio", { name: "Chuyển khỏi phòng cũ" })).toBeChecked();
  await screen.getByRole("button", { name: "Tạo phòng ban" }).click();
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({
    method: "POST",
    path: "/api/Departments",
    body: { code: "KT", name: "Kế toán", description: null, parentId: 1, headIds: [7], deputyIds: [], memberIds: [9], placement: "Transfer" },
  });
  await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith(5));
});

test("creating from step one sends no staff", async () => {
  const writes = mockApi();
  const screen = await render(<Harness parentId={1} />);
  await typeName(screen, "Kế toán");
  await screen.getByRole("button", { name: "Tạo phòng ban" }).click();
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toEqual({
    code: "KT", name: "Kế toán", description: null, parentId: 1, headIds: [], deputyIds: [], memberIds: [], placement: "Transfer",
  });
});

test("the preview follows what is typed", async () => {
  mockApi();
  const screen = await render(<Harness parentId={1} />);
  // Above the card: the parent it will hang from.
  await expect.element(screen.getByText("Ban Giám đốc", { exact: true }).last()).toBeVisible();
  await typeName(screen, "Kế toán");
  const card = screen.getByRole("group", { name: "Kế toán", exact: true });
  await expect.element(card).toBeVisible();
  await expect.element(card.getByText("Chưa có trưởng phòng")).toBeVisible();
  await expect.element(card.getByText("0 nhân viên")).toBeVisible();
  await screen.getByRole("button", { name: "Tiếp" }).click();
  await picker(screen, "Trưởng phòng").getByRole("button", { name: /Trần Văn Hùng/ }).click();
  await picker(screen, "Nhân viên").getByRole("button", { name: /Lê Thị Mai/ }).click();
  await expect.element(card.getByText("Trần Văn Hùng", { exact: true })).toBeVisible();
  await expect.element(card.getByText("2 nhân viên")).toBeVisible();
});

test("a person chosen as head cannot be chosen as member", async () => {
  mockApi();
  const screen = await render(<Harness />);
  await typeName(screen, "Kế toán");
  await screen.getByRole("button", { name: "Tiếp" }).click();
  const hung = (name: string) => picker(screen, name).getByRole("button", { name: /Trần Văn Hùng/ });
  await expect.element(hung("Nhân viên")).toBeEnabled();
  await hung("Trưởng phòng").click();
  await expect.element(hung("Nhân viên")).toBeDisabled();
  await expect.element(hung("Phó phòng")).toBeDisabled();
});

test("editing cannot choose the department or its sub-departments as parent", async () => {
  mockApi();
  const screen = await render(<Harness mode="edit" department={nodes[1]} parentId={1} />);
  await screen.getByRole("button", { name: /Phòng ban cha/ }).click();
  await expect.element(screen.getByRole("option", { name: "Báo Tuổi Trẻ (cấp cao nhất)" })).toBeVisible();
  await expect.element(screen.getByRole("option", { name: "Ban Giám đốc" })).toBeVisible();
  // Itself, its sub-department and the inactive one are not offered.
  await expect.element(screen.getByRole("option", { name: "Phòng Kỹ thuật" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("option", { name: "Tổ Mạng" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("option", { name: "Phòng cũ" })).not.toBeInTheDocument();
});

test("editing sends the full head and deputy sets and only new members", async () => {
  const writes = mockApi(() => new Response(null, { status: 204 }));
  const onSaved = vi.fn();
  const screen = await render(<Harness mode="edit" department={nodes[1]} parentId={1} onSaved={onSaved} />);
  // The name field holds the untranslated name.
  await expect.element(screen.getByRole("textbox", { name: "Tên phòng ban" })).toHaveValue("Kỹ thuật (gốc)");
  await expect.element(screen.getByRole("textbox", { name: "Mã phòng ban" })).toHaveValue("KTH");
  await screen.getByRole("button", { name: "Nhân sự" }).click();
  // The current heads and deputies are already chosen.
  await expect.element(picker(screen, "Trưởng phòng").getByText("Phạm An")).toBeVisible();
  await expect.element(picker(screen, "Phó phòng").getByText("Đỗ Bình")).toBeVisible();
  await picker(screen, "Thêm nhân viên").getByRole("button", { name: /Lê Thị Mai/ }).click();
  await screen.getByRole("button", { name: "Lưu" }).click();
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({
    method: "PUT",
    path: "/api/Departments/2",
    body: {
      code: "KTH", name: "Kỹ thuật (gốc)", originalName: "Kỹ thuật (gốc)", description: "Làm kỹ thuật", parentId: 1,
      headIds: [11], deputyIds: [12], newMemberIds: [9], placement: "Transfer",
    },
  });
  await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith(2));
});

test("closing with changes asks first", async () => {
  mockApi();
  const onClose = vi.fn();
  const screen = await render(<Harness onClose={onClose} />);
  await typeName(screen, "Kế toán");
  await screen.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect.element(screen.getByText("Đóng trình hướng dẫn? Dữ liệu đã nhập sẽ mất.")).toBeVisible();
  expect(onClose).not.toHaveBeenCalled();
  await screen.getByRole("button", { name: "Ở lại" }).click();
  await expect.element(screen.getByText("Đóng trình hướng dẫn? Dữ liệu đã nhập sẽ mất.")).not.toBeInTheDocument();
  await expect.element(screen.getByRole("textbox", { name: "Tên phòng ban" })).toHaveValue("Kế toán");
  expect(onClose).not.toHaveBeenCalled();
  // Asked again, and this time agreed.
  await screen.getByRole("button", { name: "Đóng", exact: true }).click();
  await screen.getByRole("button", { name: "Đóng", exact: true }).click();
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("closing without changes does not ask", async () => {
  mockApi();
  const onClose = vi.fn();
  const screen = await render(<Harness onClose={onClose} />);
  await screen.getByRole("button", { name: "Đóng", exact: true }).click();
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("a server field error shows on the field", async () => {
  mockApi(() => Response.json(
    { status: 400, code: "validation_failed", detail: "Dữ liệu không hợp lệ.", errors: { Name: ["Tên phòng ban đã tồn tại."] } },
    { status: 400 },
  ));
  const onSaved = vi.fn();
  const screen = await render(<Harness onSaved={onSaved} />);
  await typeName(screen, "Kế toán");
  await screen.getByRole("button", { name: "Tạo phòng ban" }).click();
  await expect.element(screen.getByText("Tên phòng ban đã tồn tại.")).toBeVisible();
  expect(onSaved).not.toHaveBeenCalled();
});

test("chosen people keep their names when going back and forward", async () => {
  mockApi();
  const screen = await render(<Harness />);
  await typeName(screen, "Kế toán");
  await screen.getByRole("button", { name: "Tiếp" }).click();
  await picker(screen, "Trưởng phòng").getByRole("button", { name: /Trần Văn Hùng/ }).click();
  await picker(screen, "Nhân viên").getByRole("button", { name: /Lê Thị Mai/ }).click();
  await screen.getByRole("button", { name: "Quay lại" }).click();
  await screen.getByRole("button", { name: "Tiếp" }).click();
  await expect.element(picker(screen, "Trưởng phòng").getByRole("button", { name: "Bỏ chọn Trần Văn Hùng" })).toBeVisible();
  await expect.element(picker(screen, "Nhân viên").getByRole("button", { name: "Bỏ chọn Lê Thị Mai" })).toBeVisible();
  await expect.element(screen.getByText("#7")).not.toBeInTheDocument();
});

test("editing offers no head or deputy picker, and no Save, until the current sets are loaded", async () => {
  let release!: () => void;
  const writes = mockApi(() => new Response(null, { status: 204 }), new Promise<void>((resolve) => { release = resolve; }));
  const screen = await render(<Harness mode="edit" department={nodes[1]} parentId={1} />);
  await screen.getByRole("button", { name: "Nhân sự" }).click();
  // Loading: nothing to pick heads from, and Save cannot be pressed.
  await expect.element(picker(screen, "Trưởng phòng")).not.toBeInTheDocument();
  await expect.element(picker(screen, "Phó phòng")).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
  release();
  await expect.element(picker(screen, "Trưởng phòng").getByText("Phạm An")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Lưu" })).toBeEnabled();
  await screen.getByRole("button", { name: "Lưu" }).click();
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({ headIds: [11], deputyIds: [12] });
});

test("editing saves from the first step too, once the current sets are loaded", async () => {
  let release!: () => void;
  const writes = mockApi(() => new Response(null, { status: 204 }), new Promise<void>((resolve) => { release = resolve; }));
  const onSaved = vi.fn();
  const screen = await render(<Harness mode="edit" department={nodes[1]} parentId={1} onSaved={onSaved} />);
  // Still on "Thông tin": Save is there but waits for the leaders (otherwise it would send empty sets).
  await expect.element(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
  release();
  await expect.element(screen.getByRole("button", { name: "Lưu" })).toBeEnabled();
  await typeName(screen, "Kỹ thuật mới");
  await screen.getByRole("button", { name: "Lưu" }).click();
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({ name: "Kỹ thuật mới", originalName: "Kỹ thuật mới", headIds: [11], deputyIds: [12], newMemberIds: [] });
  await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith(2));
});

test("editing a department with more heads than one page cannot be saved", async () => {
  const writes = mockApi(undefined, undefined, true);
  const screen = await render(<Harness mode="edit" department={nodes[1]} parentId={1} />);
  await screen.getByRole("button", { name: "Nhân sự" }).click();
  await expect.element(screen.getByText(/nên không thể sửa tại đây/)).toBeVisible();
  await expect.element(picker(screen, "Trưởng phòng")).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
  expect(writes).toHaveLength(0);
});

test("the refusal of an inactive department shows as a form-level alert", async () => {
  mockApi(() => Response.json(
    { status: 400, code: "validation_failed", detail: "Dữ liệu không hợp lệ.", errors: { Id: ["Phòng ban đã ngừng hoạt động."] } },
    { status: 400 },
  ));
  const onSaved = vi.fn();
  const screen = await render(<Harness mode="edit" department={nodes[1]} parentId={1} onSaved={onSaved} />);
  await screen.getByRole("button", { name: "Nhân sự" }).click();
  await expect.element(picker(screen, "Trưởng phòng").getByText("Phạm An")).toBeVisible();
  await screen.getByRole("button", { name: "Lưu" }).click();
  await expect.element(screen.getByRole("alert").getByText("Phòng ban đã ngừng hoạt động.")).toBeVisible();
  expect(onSaved).not.toHaveBeenCalled();
});
