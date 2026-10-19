import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type DepartmentChartDto, type DepartmentChartNode, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { DepartmentsAdmin } from "./DepartmentsAdmin";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/admin/departments" }));
afterEach(() => vi.restoreAllMocks());

/** Hands a mocked fetch what RTK Query sent (it passes a Request). */
const withRequest = (handler: (url: string, method: string) => Promise<Response> | Response) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    return handler(request.url, request.method);
  };

const node = (fields: Partial<DepartmentChartNode> & Pick<DepartmentChartNode, "id" | "name">): DepartmentChartNode => ({
  code: `D${fields.id}`, originalName: fields.name, description: null, parentId: null, isActive: true,
  memberCount: 0, childCount: 0, headCount: 0, heads: [], ...fields,
});

const chart: DepartmentChartDto = {
  organizationName: "Báo Tuổi Trẻ",
  myDepartmentIds: [3],
  departments: [
    node({ id: 1, name: "Ban Giám đốc", childCount: 2, memberCount: 3 }),
    node({
      id: 2, name: "Phòng Kỹ thuật", parentId: 1, childCount: 1, memberCount: 7, headCount: 2,
      heads: [{ userId: 11, fullName: "An", avatarUrl: null }],
    }),
    node({ id: 3, name: "Tổ Mạng", parentId: 2, memberCount: 2 }),
    node({ id: 4, name: "Phòng cũ", parentId: 1, isActive: false }),
  ],
};

/** Answers the chart; returns every API path requested, in order. */
function mockChart(body: DepartmentChartDto = chart) {
  const requested: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withRequest((url) => {
    const path = new URL(url).pathname.replace(/^.*?(?=\/api\/)/, "");
    requested.push(path);
    if (path === "/api/Departments/chart") return Response.json(body);
    // The details panel's lists: nobody in any group (and nobody to pick).
    if (path === "/api/Users") {
      return Response.json({ items: [], pageNumber: 1, totalPages: 0, totalCount: 0, hasPreviousPage: false, hasNextPage: false });
    }
    if (/^\/api\/Departments\/\d+\/members$/.test(path)) {
      return Response.json({ items: [], pageNumber: 1, totalPages: 0, totalCount: 0, hasPreviousPage: false, hasNextPage: false });
    }
    return Response.json({});
  }));
  return requested;
}

const everything = [Permissions.Departments.View, Permissions.Departments.Create, Permissions.Departments.Update, Permissions.Departments.Delete];

function Harness({ permissions }: { permissions: string[] }) {
  // One store per test: RTK Query keeps what it read, which must not leak from one test into the next.
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 9, fullName: "Quản lý", isAdministrator: false } as UserDto,
      permissions,
    }));
    return own;
  });
  return <Provider store={store}><DepartmentsAdmin /></Provider>;
}

test("without Departments.View, the no-access alert and no request", async () => {
  const requested = mockChart();
  const screen = await render(<Harness permissions={[Permissions.Users.View]} />);
  await expect.element(screen.getByText("Bạn không có quyền xem mục quản trị.")).toBeVisible();
  await expect.element(screen.getByText("Báo Tuổi Trẻ")).not.toBeInTheDocument();
  expect(requested).toEqual([]);
});

test("with Departments.View, the page region and no alert", async () => {
  mockChart();
  const screen = await render(<Harness permissions={[Permissions.Departments.View]} />);
  await expect.element(screen.getByRole("region", { name: "Phòng ban" })).toBeInTheDocument();
  await expect.element(screen.getByText("Bạn không có quyền xem mục quản trị.")).not.toBeInTheDocument();
});

test("draws the organization and the tree", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  await expect.element(screen.getByText("Báo Tuổi Trẻ")).toBeVisible();
  const engineering = screen.getByRole("group", { name: "Phòng Kỹ thuật" });
  await expect.element(engineering).toBeVisible();
  await expect.element(engineering.getByText("An", { exact: true })).toBeVisible();
  await expect.element(engineering.getByText("+1")).toBeVisible();
  await expect.element(engineering.getByText("7 nhân viên")).toBeVisible();
  const network = screen.getByRole("group", { name: "Tổ Mạng" });
  await expect.element(network.getByText("Chưa có trưởng phòng")).toBeVisible();
  await expect.element(network.getByText("Phòng của bạn")).toBeVisible();
});

test("collapsing a card hides its sub-departments", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  await expect.element(screen.getByRole("group", { name: "Tổ Mạng" })).toBeVisible();
  await screen.getByRole("button", { name: "1 phòng ban con" }).click();
  await expect.element(screen.getByRole("group", { name: "Tổ Mạng" })).not.toBeInTheDocument();
  await screen.getByRole("button", { name: "1 phòng ban con" }).click();
  await expect.element(screen.getByRole("group", { name: "Tổ Mạng" })).toBeVisible();
});

test("find me opens the viewer's department", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  await screen.getByRole("button", { name: "1 phòng ban con" }).click();
  await expect.element(screen.getByRole("group", { name: "Tổ Mạng" })).not.toBeInTheDocument();
  await screen.getByRole("button", { name: "Tìm tôi" }).click();
  const mine = screen.getByRole("group", { name: "Tổ Mạng" });
  await expect.element(mine).toBeVisible();
  await expect.element(mine).toHaveAttribute("aria-current", "true");
});

test("an inactive department is faded and has no add button", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  const old = screen.getByRole("group", { name: "Phòng cũ" });
  await expect.element(old).toHaveClass("opacity-60");
  await expect.element(old.getByText("Ngừng hoạt động")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Thêm phòng ban con vào Phòng cũ" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Thêm phòng ban con vào Phòng Kỹ thuật" })).toBeVisible();
});

test("without Departments.Create there is no add button anywhere", async () => {
  mockChart();
  const screen = await render(<Harness permissions={[Permissions.Departments.View, Permissions.Departments.Update]} />);
  await expect.element(screen.getByRole("group", { name: "Phòng Kỹ thuật" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /^Thêm phòng ban/ })).not.toBeInTheDocument();
});

test("zoom shows its level", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  await expect.element(screen.getByText("100 %")).toBeVisible();
  await screen.getByRole("button", { name: "Phóng to" }).click();
  await expect.element(screen.getByText("110 %")).toBeVisible();
  await screen.getByRole("button", { name: "Thu nhỏ" }).click();
  await screen.getByRole("button", { name: "Thu nhỏ" }).click();
  await expect.element(screen.getByText("90 %")).toBeVisible();
});

test("a menu offers only the actions the viewer may do", async () => {
  mockChart();
  const screen = await render(<Harness permissions={[Permissions.Departments.View, Permissions.Departments.Delete]} />);
  await screen.getByRole("button", { name: "Thao tác với Phòng Kỹ thuật" }).click();
  await expect.element(screen.getByRole("menuitem", { name: "Xóa phòng ban" })).toBeVisible();
  await expect.element(screen.getByRole("menuitem", { name: "Sửa phòng ban" })).not.toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
});

test("an empty list says so", async () => {
  mockChart({ organizationName: "Báo Tuổi Trẻ", departments: [], myDepartmentIds: [] });
  const screen = await render(<Harness permissions={everything} />);
  await expect.element(screen.getByText("Chưa có phòng ban nào. Bắt đầu bằng cách thêm phòng ban đầu tiên.")).toBeVisible();
});

const selectEngineering = async (screen: Awaited<ReturnType<typeof render>>) =>
  screen.getByRole("group", { name: "Phòng Kỹ thuật" }).getByRole("button", { name: "Phòng Kỹ thuật", exact: true }).click();

test("selecting a card opens its details panel and closing it clears the selection", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  await expect.element(screen.getByRole("complementary", { name: "Chi tiết phòng ban" })).not.toBeInTheDocument();
  await selectEngineering(screen);
  const panel = screen.getByRole("complementary", { name: "Chi tiết phòng ban" });
  await expect.element(panel.getByRole("heading", { name: "Phòng Kỹ thuật" })).toBeVisible();
  await expect.element(panel.getByText("Tổng 7 nhân viên")).toBeVisible();
  await expect.element(screen.getByRole("group", { name: "Phòng Kỹ thuật" })).toHaveAttribute("aria-current", "true");

  await panel.getByRole("button", { name: "Đóng chi tiết" }).click();
  await expect.element(screen.getByRole("complementary", { name: "Chi tiết phòng ban" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("group", { name: "Phòng Kỹ thuật" })).not.toHaveAttribute("aria-current");
});

test("the panel's menu offers what the card's does", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  await screen.getByRole("button", { name: "Thao tác với Phòng Kỹ thuật" }).click();
  const names = () => screen.getByRole("menuitem").elements().map((item) => item.textContent);
  await expect.element(screen.getByRole("menu")).toBeVisible();
  const cardItems = names();
  await userEvent.keyboard("{Escape}");

  await selectEngineering(screen);
  await screen.getByRole("button", { name: "Thao tác phòng ban" }).click();
  await expect.element(screen.getByRole("menu")).toBeVisible();
  expect(names()).toEqual(cardItems);
  expect(cardItems).toContain("Chuyển nhân viên về phòng này");
});

test("the card menu's staff items open the add-people dialog", async () => {
  mockChart();
  const screen = await render(<Harness permissions={everything} />);
  await screen.getByRole("button", { name: "Thao tác với Phòng Kỹ thuật" }).click();
  await screen.getByRole("menuitem", { name: "Chuyển nhân viên về phòng này" }).click();
  await expect.element(screen.getByRole("dialog", { name: "Chuyển nhân viên về phòng này" })).toBeVisible();
  await screen.getByRole("button", { name: "Huỷ" }).click();
  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();

  await screen.getByRole("button", { name: "Thao tác với Phòng Kỹ thuật" }).click();
  await screen.getByRole("menuitem", { name: "Thêm nhân viên đa phòng ban" }).click();
  await expect.element(screen.getByRole("dialog", { name: "Thêm nhân viên đa phòng ban" })).toBeVisible();
});
