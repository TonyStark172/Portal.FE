import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { Toast, toast } from "@heroui/react";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import {
  portalApi,
  type DepartmentChartNode,
  type DepartmentMemberDto,
  type DepartmentRole,
  type PositionDto,
  type UserDto,
} from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { DepartmentPanel } from "./DepartmentPanel";

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

const department: DepartmentChartNode = {
  id: 2, code: "KT", name: "Phòng Kỹ thuật", originalName: "Phòng Kỹ thuật", description: "Hạ tầng và phát triển phần mềm.",
  parentId: 1, isActive: true, memberCount: 3, childCount: 0, headCount: 1, heads: [],
};

const member = (fields: Partial<DepartmentMemberDto> & Pick<DepartmentMemberDto, "userId" | "fullName" | "role">): DepartmentMemberDto => ({
  userName: `u${fields.userId}`, positionId: null, positionName: null, positionLevel: null, isPrimary: false, avatarUrl: null, ...fields,
});

const people: Record<DepartmentRole, DepartmentMemberDto[]> = {
  Head: [member({ userId: 11, fullName: "Trần Thị Hà", role: "Head", positionId: 1, positionName: "Trưởng phòng", isPrimary: true })],
  Deputy: [member({ userId: 12, fullName: "Lê Minh Khoa", role: "Deputy", positionId: 2, positionName: "Phó phòng" })],
  Member: [
    member({ userId: 7, fullName: "Nguyễn Văn An", role: "Member", positionId: 5, positionName: "Chuyên viên", isPrimary: true }),
    member({ userId: 8, fullName: "Phạm Bình", role: "Member" }),
  ],
};
const nobody: Record<DepartmentRole, DepartmentMemberDto[]> = { Head: [], Deputy: [], Member: [] };

const positions: PositionDto[] = [
  { id: 5, code: "SPEC", name: "Chuyên viên", originalName: "Chuyên viên", level: 5, isActive: true },
  { id: 6, code: "SENIOR", name: "Chuyên viên chính", originalName: "Chuyên viên chính", level: 4, isActive: true },
];

const candidates = [
  { id: 9, fullName: "Võ Thị Hoa", userName: "hoa.vt" },
  { id: 10, fullName: "Đặng Quốc", userName: "quoc.d" },
].map((user) => ({ ...user, emailConfirmed: true, isAdministrator: false, isActive: true, mustChangePassword: false, assignments: [], roles: [] }) as UserDto);

type Write = { method: string; path: string; body: unknown };
/** Answers what the panel reads, and every write with 204; returns the member requests (as query strings) and the writes. */
function mockApi(by: Record<DepartmentRole, DepartmentMemberDto[]> = people, reply: (write: Write) => Response = () => new Response(null, { status: 204 })) {
  const reads: URLSearchParams[] = [];
  const writes: Write[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withRequest((url, init) => {
    const { pathname, searchParams, search } = new URL(url);
    const path = pathname.replace(/^.*?(?=\/api\/)/, "");
    if (init.method === "GET") {
      if (path === "/api/Departments/2/members") {
        reads.push(searchParams);
        const items = by[searchParams.get("role") as DepartmentRole] ?? [];
        return Response.json({ items, pageNumber: 1, totalPages: 1, totalCount: items.length, hasPreviousPage: false, hasNextPage: false });
      }
      if (path === "/api/Positions") return Response.json(positions);
      if (path === "/api/Users") {
        return Response.json({ items: candidates, pageNumber: 1, totalPages: 1, totalCount: candidates.length, hasPreviousPage: false, hasNextPage: false });
      }
      return Response.json({});
    }
    const write = { method: init.method, path: path + search, body: init.body ? JSON.parse(init.body) : null };
    writes.push(write);
    return reply(write);
  }));
  return { reads, writes };
}

const everything = [Permissions.Departments.View, Permissions.Departments.Update, Permissions.Users.View, Permissions.Positions.View];

function Harness({ permissions = everything, node = department }: { permissions?: string[]; node?: DepartmentChartNode }) {
  // One store per test: RTK Query keeps what it read, which must not leak from one test into the next.
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 99, fullName: "Quản lý", isAdministrator: false } as UserDto,
      permissions,
    }));
    return own;
  });
  return (
    <Provider store={store}>
      <Toast.Provider />
      <DepartmentPanel node={node} onClose={() => undefined} onMenuAction={() => undefined} />
    </Provider>
  );
}

type Screen = Awaited<ReturnType<typeof render>>;
const rowMenu = (screen: Screen, name: string) => screen.getByRole("button", { name: `Thao tác với ${name}` });

async function openRowMenu(screen: Screen, name: string) {
  await expect.element(screen.getByText(name, { exact: true })).toBeVisible();
  await userEvent.click(rowMenu(screen, name));
  await expect.element(screen.getByRole("menu")).toBeVisible();
}

test("lists heads, deputies and members, each from its own request", async () => {
  const { reads } = mockApi();
  const screen = await render(<Harness />);
  await expect.element(screen.getByText("Trần Thị Hà", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("Lê Minh Khoa", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("Nguyễn Văn An", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("Trưởng phòng 1")).toBeVisible();
  await expect.element(screen.getByText("Phó phòng 1")).toBeVisible();
  await expect.element(screen.getByText("Nhân viên 2")).toBeVisible();
  await expect.element(screen.getByText("Tổng 3 nhân viên")).toBeVisible();
  await expect.element(screen.getByText("Hạ tầng và phát triển phần mềm.")).toBeVisible();

  expect(reads.map((read) => read.get("role")).sort()).toEqual(["Deputy", "Head", "Member"]);
  const sizes = Object.fromEntries(reads.map((read) => [read.get("role"), read.get("pageSize")]));
  expect(sizes).toEqual({ Head: "100", Deputy: "100", Member: "50" });
});

test("a person without a position shows the placeholder", async () => {
  mockApi();
  const screen = await render(<Harness />);
  await expect.element(screen.getByText("Phạm Bình", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("Chưa có chức danh")).toBeVisible();
  await expect.element(screen.getByText("Chuyên viên", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("Phòng chính").first()).toBeVisible();
});

test("making a member a deputy keeps the position", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await openRowMenu(screen, "Nguyễn Văn An");
  // The member's current role is not offered.
  await expect.element(screen.getByRole("menuitem", { name: "Đặt làm nhân viên" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("menuitem", { name: "Đặt làm phó phòng" }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({ method: "PUT", path: "/api/Departments/2/members/7", body: { role: "Deputy", positionId: 5 } });
  await expect.element(screen.getByText("Đã cập nhật.")).toBeVisible();
});

test("clearing the position sends null", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await openRowMenu(screen, "Nguyễn Văn An");
  await userEvent.click(screen.getByRole("menuitem", { name: "Đổi chức danh…" }));
  const dialog = screen.getByRole("dialog", { name: "Đổi chức danh của Nguyễn Văn An" });
  await userEvent.click(dialog.getByRole("button", { name: /Chức danh/ }));
  await userEvent.click(screen.getByRole("option", { name: "Không có chức danh" }));
  await userEvent.click(dialog.getByRole("button", { name: "Lưu" }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({ method: "PUT", path: "/api/Departments/2/members/7", body: { role: "Member", positionId: null } });
});

test("removing asks first, then deletes", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await openRowMenu(screen, "Nguyễn Văn An");
  await userEvent.click(screen.getByRole("menuitem", { name: "Gỡ khỏi phòng" }));
  await expect.element(screen.getByText("Gỡ Nguyễn Văn An khỏi Phòng Kỹ thuật?")).toBeVisible();
  expect(writes).toEqual([]);
  await userEvent.click(screen.getByRole("button", { name: "Gỡ khỏi phòng", exact: true }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({ method: "DELETE", path: "/api/Departments/2/members/7", body: null });
  await expect.element(screen.getByText("Đã gỡ khỏi phòng.")).toBeVisible();
});

test("making someone the primary department is offered only where it is not already", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await openRowMenu(screen, "Nguyễn Văn An");
  await expect.element(screen.getByRole("menuitem", { name: "Đặt làm phòng chính" })).not.toBeInTheDocument();
  await userEvent.keyboard("{Escape}");

  await openRowMenu(screen, "Phạm Bình");
  await userEvent.click(screen.getByRole("menuitem", { name: "Đặt làm phòng chính" }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].method).toBe("PUT");
  expect(writes[0].path).toBe("/api/Departments/2/members/8/primary");
});

test("adding deputies alongside", async () => {
  const { writes } = mockApi();
  const screen = await render(<Harness />);
  await expect.element(screen.getByText("Lê Minh Khoa", { exact: true })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Thao tác · Phó phòng" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Thêm…" }));
  const dialog = screen.getByRole("dialog", { name: "Thêm phó phòng" });
  // The default is to move people out of their old department.
  await expect.element(dialog.getByRole("radio", { name: "Chuyển khỏi phòng cũ" })).toBeChecked();
  await userEvent.click(dialog.getByText(/Giữ ở phòng cũ/));
  await expect.element(dialog.getByRole("radio", { name: /Giữ ở phòng cũ/ })).toBeChecked();
  await userEvent.click(dialog.getByRole("button", { name: /Võ Thị Hoa/ }));
  await userEvent.click(dialog.getByRole("button", { name: "Thêm", exact: true }));
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({
    method: "POST",
    path: "/api/Departments/2/members",
    body: { userIds: [9], role: "Deputy", placement: "Alongside" },
  });
});

test("a refused add stays open and says why", async () => {
  mockApi(people, () => Response.json({ status: 409, code: "conflict", detail: "Người này đã ở phòng này." }, { status: 409 }));
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: "Thao tác · Nhân viên" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Thêm…" }));
  const dialog = screen.getByRole("dialog", { name: "Thêm nhân viên" });
  await userEvent.click(dialog.getByRole("button", { name: /Võ Thị Hoa/ }));
  await userEvent.click(dialog.getByRole("button", { name: "Thêm", exact: true }));
  await expect.element(dialog.getByText("Người này đã ở phòng này.")).toBeVisible();
});

test("an empty department invites adding people", async () => {
  mockApi(nobody);
  const screen = await render(<Harness node={{ ...department, memberCount: 0 }} />);
  await expect.element(screen.getByText("Thêm nhân viên — chuyển nhân viên từ phòng khác hoặc thêm người vào phòng này.")).toBeVisible();
  await expect.element(screen.getByText("Chỉ định trưởng phòng")).toBeVisible();
  await expect.element(screen.getByText("Chỉ định phó phòng")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Thêm", exact: true }));
  await expect.element(screen.getByRole("dialog", { name: "Thêm nhân viên" })).toBeVisible();
});

test("without the right to update, no action menus", async () => {
  mockApi();
  const screen = await render(<Harness permissions={[Permissions.Departments.View]} />);
  await expect.element(screen.getByText("Nguyễn Văn An", { exact: true })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /Thao tác/ })).not.toBeInTheDocument();
});

test("searching asks again for every group, after a pause", async () => {
  const { reads } = mockApi();
  const screen = await render(<Harness />);
  await expect.element(screen.getByText("Nguyễn Văn An", { exact: true })).toBeVisible();
  await userEvent.fill(screen.getByRole("searchbox", { name: "Tìm nhân viên trong phòng" }), "An");
  await vi.waitFor(() => expect(reads.filter((read) => read.get("search") === "An").map((read) => read.get("role")).sort()).toEqual(["Deputy", "Head", "Member"]));
});
