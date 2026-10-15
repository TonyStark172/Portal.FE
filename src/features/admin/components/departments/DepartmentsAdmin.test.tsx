import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import {
  portalApi,
  type DepartmentDto,
  type DepartmentTreeNode,
  type PaginatedListOfDepartmentMemberDto,
  type UserDto,
} from "@/shared/api/generated/portalApi";
import { Permissions, type Permission } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { DepartmentsAdmin } from "./DepartmentsAdmin";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/admin/departments" }));
afterEach(() => vi.restoreAllMocks());

const withRequest = (handler: (url: string, init: { method: string; body: string | null }) => Promise<Response> | Response) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    return handler(request.url, { method: request.method, body: ["GET", "HEAD"].includes(request.method) ? null : await request.clone().text() });
  };

const node = (id: number, name: string, children: DepartmentTreeNode[] = [], isActive = true): DepartmentTreeNode =>
  ({ id, code: `D${id}`, name, isActive, children });
/** Ban biên tập(1) > [Tổ thư ký(4)]; "IT Department"(3) is shown in English, its original name is Vietnamese. */
const tree = [node(1, "Ban biên tập", [node(4, "Tổ thư ký")]), node(3, "IT Department", [], false)];

const department = (fields: Partial<DepartmentDto> & Pick<DepartmentDto, "id" | "name">): DepartmentDto => ({
  code: `D${fields.id}`, originalName: fields.name, parentId: null, parentName: null, isActive: true,
  memberCount: 0, childCount: 0, canDelete: true, ...fields,
});
const departments: Record<number, DepartmentDto> = {
  1: department({ id: 1, name: "Ban biên tập", memberCount: 5, childCount: 1, canDelete: false }),
  3: department({ id: 3, name: "IT Department", originalName: "Phòng Kỹ thuật", isActive: false }),
  4: department({ id: 4, name: "Tổ thư ký", parentId: 1, parentName: "Ban biên tập", memberCount: 1, canDelete: false }),
};
const members: PaginatedListOfDepartmentMemberDto = {
  items: [
    { userId: 7, userName: "an.nv", fullName: "Nguyễn Văn An", positionId: 1, positionName: "Tổng biên tập", positionLevel: 1, isPrimary: true, isHead: true },
    { userId: 8, userName: "binh.tt", fullName: "Trần Thị Bình", positionId: 2, positionName: "Phóng viên", positionLevel: 5, isPrimary: false, isHead: false },
  ],
  pageNumber: 1, totalPages: 3, totalCount: 5, hasPreviousPage: false, hasNextPage: true,
};
const noMembers: PaginatedListOfDepartmentMemberDto = { ...members, items: [], totalPages: 0, totalCount: 0, hasNextPage: false };

type Write = { method: string; path: string; body: unknown };
function mockDepartments(reply: (write: Write) => Response = () => new Response(null, { status: 204 })) {
  const writes: Write[] = [];
  const requested: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withRequest((url, init) => {
    const { pathname, searchParams } = new URL(url);
    const path = pathname.replace(/^.*?(?=\/api\/)/, "");
    requested.push(path);
    if (init.method === "GET") {
      if (path === "/api/Departments/tree") return Response.json(tree);
      if (path === "/api/Departments") {
        const search = (searchParams.get("Search") ?? "").toLowerCase();
        return Response.json(Object.values(departments).filter(one => one.name.toLowerCase().includes(search)));
      }
      const membersOf = path.match(/^\/api\/Departments\/(\d+)\/members$/);
      if (membersOf) return Response.json(membersOf[1] === "1" ? members : noMembers);
      const one = path.match(/^\/api\/Departments\/(\d+)$/);
      if (one) return Response.json(departments[Number(one[1])]);
    }
    if (path.startsWith("/api/Departments")) {
      const write = { method: init.method, path, body: init.body ? JSON.parse(init.body) : null };
      writes.push(write);
      return reply(write);
    }
    return Response.json({});
  }));
  return { writes, requested };
}

function Harness({ permissions }: { permissions: Permission[] }) {
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 1, fullName: "An", isAdministrator: false } as UserDto,
      permissions,
    }));
    return own;
  });
  return <Provider store={store}><DepartmentsAdmin /></Provider>;
}

const everything = [Permissions.Departments.View, Permissions.Departments.Create, Permissions.Departments.Update, Permissions.Departments.Delete];
type Screen = Awaited<ReturnType<typeof render>>;
const card = (screen: Screen, name: string) => screen.getByRole("article", { name });
const details = (screen: Screen) => screen.getByRole("dialog").getByRole("region", { name: "Thông tin phòng ban" });
const openMenu = (screen: Screen, name: string) => userEvent.click(screen.getByRole("button", { name: `Thao tác với ${name}` }));

test("without the right to view departments: no page, nothing asked", async () => {
  const { requested } = mockDepartments();
  const screen = await render(<Harness permissions={[]} />);
  await expect.element(screen.getByText("Bạn không có quyền xem mục quản trị.")).toBeVisible();
  expect(requested.filter(path => path.startsWith("/api/Departments"))).toEqual([]);
});

test("one card per department, in the order of the tree, with its parent, counts, faces and code", async () => {
  mockDepartments();
  const screen = await render(<Harness permissions={[Permissions.Departments.View]} />);
  const board = card(screen, "Ban biên tập");
  await expect.element(board).toHaveTextContent("Cấp cao nhất");
  await expect.element(board).toHaveTextContent("5 thành viên · 1 phòng ban con");
  await expect.element(board.getByRole("img", { name: /Nguyễn Văn An, Trần Thị Bình/ })).toBeVisible();
  await expect.element(board.getByText("+3")).toBeVisible();
  await expect.element(board.getByText("D1", { exact: true })).toBeVisible();
  await expect.element(card(screen, "Tổ thư ký")).toHaveTextContent("Trực thuộc Ban biên tập");
  await expect.element(card(screen, "IT Department")).toHaveTextContent("Ngừng hoạt động");
  expect(screen.getByRole("article").elements().map(one => one.getAttribute("aria-label")))
    .toEqual(["Ban biên tập", "Tổ thư ký", "IT Department"]);
});

test("a card opens the department's details and members", async () => {
  mockDepartments();
  const screen = await render(<Harness permissions={[Permissions.Departments.View]} />);
  await userEvent.click(card(screen, "Ban biên tập").getByRole("button", { name: "Ban biên tập", exact: true }));
  await expect.element(details(screen).getByRole("heading", { name: "Ban biên tập" })).toBeVisible();
  const head = screen.getByRole("listitem", { name: "Nguyễn Văn An" });
  await expect.element(head).toHaveTextContent("Tổng biên tập");
  await expect.element(head).toHaveTextContent("Trưởng");
  await expect.element(screen.getByRole("listitem", { name: "Trần Thị Bình" })).toHaveTextContent("(kiêm nhiệm)");
});

test("the search asks the server for the departments whose name matches", async () => {
  mockDepartments();
  const screen = await render(<Harness permissions={[Permissions.Departments.View]} />);
  await expect.element(card(screen, "IT Department")).toBeVisible();
  await userEvent.fill(screen.getByRole("searchbox", { name: "Tìm phòng ban" }), "thư");
  await expect.element(card(screen, "IT Department")).not.toBeInTheDocument();
  await expect.element(card(screen, "Tổ thư ký")).toBeVisible();
  await userEvent.fill(screen.getByRole("searchbox", { name: "Tìm phòng ban" }), "không có");
  await expect.element(screen.getByText("Không tìm thấy phòng ban nào.")).toBeVisible();
});

test("viewing only: nothing to add or delete, the details read-only", async () => {
  mockDepartments();
  const screen = await render(<Harness permissions={[Permissions.Departments.View]} />);
  await expect.element(card(screen, "Ban biên tập")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Thêm phòng ban" })).not.toBeInTheDocument();
  await openMenu(screen, "Ban biên tập");
  await expect.element(screen.getByRole("menuitem", { name: "Xem chi tiết" })).toBeVisible();
  await expect.element(screen.getByRole("menuitem", { name: "Thêm phòng ban con" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("menuitem", { name: "Xoá phòng ban" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("menuitem", { name: "Xem chi tiết" }));
  await expect.element(details(screen).getByRole("textbox", { name: "Tên phòng ban" })).toHaveAttribute("readonly");
  await expect.element(details(screen).getByRole("button", { name: "Lưu" })).not.toBeInTheDocument();
});

test("a new department under the parent chosen in the dialog; save and add another keeps the dialog open", async () => {
  const { writes } = mockDepartments(() => Response.json(9, { status: 201 }));
  const screen = await render(<Harness permissions={everything} />);
  await userEvent.click(screen.getByRole("button", { name: "Thêm phòng ban" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên phòng ban" }), "Phòng Kế toán");
  await expect.element(dialog.getByRole("textbox", { name: "Mã" })).toHaveValue("PKT");
  await userEvent.click(dialog.getByRole("button", { name: /Trực thuộc/ }));
  await userEvent.click(screen.getByRole("option", { name: "Ban biên tập" }));
  await userEvent.click(dialog.getByRole("button", { name: "Lưu & thêm tiếp" }));
  await expect.poll(() => writes).toEqual([{ method: "POST", path: "/api/Departments", body: { code: "PKT", name: "Phòng Kế toán", parentId: 1 } }]);
  await expect.element(dialog.getByRole("textbox", { name: "Tên phòng ban" })).toHaveValue("");
  await expect.element(dialog.getByRole("button", { name: /Trực thuộc/ })).toHaveTextContent("Ban biên tập");

  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên phòng ban" }), "Phòng Pháp chế");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu", exact: true }));
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  expect(writes.at(-1)).toEqual({ method: "POST", path: "/api/Departments", body: { code: "PPC", name: "Phòng Pháp chế", parentId: 1 } });
});

test("a sub-department from a card's menu starts under that department", async () => {
  const { writes } = mockDepartments(() => Response.json(9, { status: 201 }));
  const screen = await render(<Harness permissions={everything} />);
  await openMenu(screen, "Tổ thư ký");
  await userEvent.click(screen.getByRole("menuitem", { name: "Thêm phòng ban con" }));
  const dialog = screen.getByRole("dialog");
  await expect.element(dialog.getByRole("button", { name: /Trực thuộc/ })).toHaveTextContent("Tổ thư ký");
  await userEvent.fill(dialog.getByRole("textbox", { name: "Tên phòng ban" }), "Nhóm Văn thư");
  await userEvent.click(dialog.getByRole("button", { name: "Lưu", exact: true }));
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  expect(writes).toEqual([{ method: "POST", path: "/api/Departments", body: { code: "NVT", name: "Nhóm Văn thư", parentId: 4 } }]);
});

test("the parent can be changed in the details, never to the department itself or below it", async () => {
  const { writes } = mockDepartments();
  const screen = await render(<Harness permissions={everything} />);
  await userEvent.click(card(screen, "Ban biên tập").getByRole("button", { name: "Ban biên tập", exact: true }));
  await expect.element(details(screen).getByRole("heading", { name: "Ban biên tập" })).toBeVisible();
  await userEvent.click(details(screen).getByRole("button", { name: /Trực thuộc/ }));
  const options = screen.getByRole("listbox").getByRole("option");
  await expect.element(options.first()).toBeVisible();
  expect(options.elements().map(option => option.textContent?.trim())).toEqual(["— Cấp cao nhất —", "IT Department"]);
  await userEvent.click(screen.getByRole("option", { name: "IT Department" }));
  await userEvent.click(details(screen).getByRole("button", { name: "Lưu" }));
  await expect.poll(() => writes).toEqual([{
    method: "PUT", path: "/api/Departments/1",
    body: { code: "D1", name: "Ban biên tập", originalName: "Ban biên tập", parentId: 3, isActive: true },
  }]);
});

test("a department with members is not deleted: it can be made inactive instead", async () => {
  const { writes } = mockDepartments();
  const screen = await render(<Harness permissions={everything} />);
  await openMenu(screen, "Ban biên tập");
  await userEvent.click(screen.getByRole("menuitem", { name: "Xoá phòng ban" }));
  const dialog = screen.getByRole("alertdialog");
  await expect.element(dialog).toHaveTextContent("Chỉ xoá được phòng ban không có thành viên");
  await expect.element(dialog.getByRole("button", { name: "Xoá" })).not.toBeInTheDocument();
  await userEvent.click(dialog.getByRole("button", { name: "Ngừng hoạt động" }));
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
  expect(writes).toEqual([{
    method: "PUT", path: "/api/Departments/1",
    body: { code: "D1", name: "Ban biên tập", originalName: "Ban biên tập", parentId: null, isActive: false },
  }]);
});

test("an empty department is deleted once confirmed; a refusal stays in the dialog", async () => {
  const { writes } = mockDepartments(() => Response.json(
    { title: "Conflict", status: 409, code: "conflict", detail: "Phòng ban đang có nhân sự." }, { status: 409 }));
  const screen = await render(<Harness permissions={everything} />);
  await openMenu(screen, "IT Department");
  await userEvent.click(screen.getByRole("menuitem", { name: "Xoá phòng ban" }));
  const dialog = screen.getByRole("alertdialog");
  await userEvent.click(dialog.getByRole("button", { name: "Xoá" }));
  await expect.element(dialog.getByRole("alert")).toHaveTextContent("Phòng ban đang có nhân sự.");
  expect(writes).toEqual([{ method: "DELETE", path: "/api/Departments/3", body: null }]);
});

test("deleting from the details closes them, and the department deleted is not read again", async () => {
  const { writes, requested } = mockDepartments();
  const screen = await render(<Harness permissions={everything} />);
  await userEvent.click(card(screen, "IT Department").getByRole("button", { name: "IT Department", exact: true }));
  await userEvent.click(details(screen).getByRole("button", { name: "Xoá phòng ban" }));
  const deletedAt = requested.length;
  await userEvent.click(screen.getByRole("alertdialog").getByRole("button", { name: "Xoá" }));
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
  expect(writes).toEqual([{ method: "DELETE", path: "/api/Departments/3", body: null }]);
  // The departments are read again…
  await expect.poll(() => requested.slice(deletedAt).includes("/api/Departments")).toBe(true);
  await new Promise(resolve => setTimeout(resolve, 200));
  // …but never the one deleted: read once to show it, then the DELETE itself.
  expect(requested.filter(path => path === "/api/Departments/3")).toHaveLength(2);
});
