import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { portalApi, type DepartmentChartDto, type DepartmentChartNode, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { DepartmentChart, type DepartmentAction } from "./DepartmentChart";

afterEach(() => vi.restoreAllMocks());

const node = (fields: Partial<DepartmentChartNode> & Pick<DepartmentChartNode, "id" | "name">): DepartmentChartNode => ({
  code: `D${fields.id}`, originalName: fields.name, description: null, parentId: null, isActive: true,
  memberCount: 0, childCount: 0, headCount: 0, heads: [], ...fields,
});

const chart: DepartmentChartDto = {
  organizationName: "Báo Tuổi Trẻ",
  myDepartmentIds: [],
  departments: [node({ id: 1, name: "Phòng Kỹ thuật" }), node({ id: 2, name: "Phòng cũ", isActive: false })],
};

const everything = [Permissions.Departments.View, Permissions.Departments.Create, Permissions.Departments.Update, Permissions.Departments.Delete];

/** The chart on its own, with a parent that keeps the selection (as DepartmentsAdmin does) and reports the menu. */
function Harness({ onMenuAction, data = chart }: { onMenuAction: (action: DepartmentAction, node: DepartmentChartNode) => void; data?: DepartmentChartDto }) {
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 9, fullName: "Quản lý", isAdministrator: false } as UserDto,
      permissions: everything,
    }));
    return own;
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  return (
    <Provider store={store}>
      <DepartmentChart chart={data} selectedId={selectedId} onSelect={setSelectedId} onAddChild={() => undefined} onMenuAction={onMenuAction} />
    </Provider>
  );
}

test("every card has the same height, with or without a head, sub-departments, a long name or the inactive mark", async () => {
  const data: DepartmentChartDto = {
    organizationName: "Báo Tuổi Trẻ",
    myDepartmentIds: [3],
    departments: [
      node({ id: 1, name: "Ban Giám đốc", childCount: 1, headCount: 2, heads: [{ userId: 7, fullName: "Nguyễn Văn An", avatarUrl: null }] }),
      node({ id: 2, name: "Phòng kế toán" }),
      node({ id: 3, name: "Phòng Hành chính nhân sự và quan hệ công chúng toàn quốc", parentId: 1 }),
      node({ id: 4, name: "Phòng cũ", isActive: false }),
    ],
  };
  const screen = await render(<Harness onMenuAction={vi.fn()} data={data} />);
  await expect.element(screen.getByText("Chưa có phòng ban con").first()).toBeVisible();
  const heights = [1, 2, 3, 4].map((id) => document.querySelector(`[data-department-id="${id}"]`)!.getBoundingClientRect().height);
  expect(new Set(heights.map(Math.round)).size).toBe(1);
});

test("clicking a card selects it, and only it", async () => {
  const screen = await render(<Harness onMenuAction={vi.fn()} />);
  const engineering = screen.getByRole("group", { name: "Phòng Kỹ thuật" });
  const old = screen.getByRole("group", { name: "Phòng cũ" });
  await expect.element(engineering).not.toHaveAttribute("aria-current");
  await engineering.click();
  await expect.element(engineering).toHaveAttribute("aria-current", "true");
  await expect.element(old).not.toHaveAttribute("aria-current");
  await old.click();
  await expect.element(old).toHaveAttribute("aria-current", "true");
  await expect.element(engineering).not.toHaveAttribute("aria-current");
});

test("choosing a menu item reports the action and the card, and does not select the card", async () => {
  const onMenuAction = vi.fn();
  const screen = await render(<Harness onMenuAction={onMenuAction} />);
  await screen.getByRole("button", { name: "Thao tác với Phòng Kỹ thuật" }).click();
  await screen.getByRole("menuitem", { name: "Sửa phòng ban" }).click();
  expect(onMenuAction).toHaveBeenCalledTimes(1);
  expect(onMenuAction).toHaveBeenCalledWith("edit", expect.objectContaining({ id: 1, name: "Phòng Kỹ thuật" }));
  await expect.element(screen.getByRole("group", { name: "Phòng Kỹ thuật" })).not.toHaveAttribute("aria-current");
});

test("an inactive department's menu offers only edit, reactivate and delete", async () => {
  const screen = await render(<Harness onMenuAction={vi.fn()} />);
  await screen.getByRole("button", { name: "Thao tác với Phòng cũ" }).click();
  await expect.element(screen.getByRole("menuitem", { name: "Sửa phòng ban" })).toBeVisible();
  await expect.element(screen.getByRole("menuitem", { name: "Kích hoạt lại" })).toBeVisible();
  await expect.element(screen.getByRole("menuitem", { name: "Xóa phòng ban" })).toBeVisible();
  await expect.element(screen.getByRole("menuitem", { name: "Thêm phòng ban con" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("menuitem", { name: "Thêm nhân viên đa phòng ban" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("menuitem", { name: "Chuyển nhân viên về phòng này" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("menuitem")).toHaveLength(3);
});

test("an organization without a name is still named on its card and its add button", async () => {
  const screen = await render(<Harness onMenuAction={vi.fn()} data={{ ...chart, organizationName: "  " }} />);
  await expect.element(screen.getByText("Tổ chức", { exact: true })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Thêm phòng ban con vào Tổ chức" })).toBeVisible();
});

test("the scroll canvas is a named, focusable region", async () => {
  const screen = await render(<Harness onMenuAction={vi.fn()} />);
  await expect.element(screen.getByRole("region", { name: "Sơ đồ tổ chức" })).toHaveAttribute("tabindex", "0");
});

/** Where a connector path ends (in the page's pixels): the SVG's own box maps onto its viewBox. */
function connectorEnds(path: SVGPathElement) {
  const svg = path.ownerSVGElement!;
  const box = svg.getBoundingClientRect();
  const view = svg.viewBox.baseVal;
  const scaleX = box.width / view.width;
  const scaleY = box.height / view.height;
  const length = path.getTotalLength();
  const start = path.getPointAtLength(0);
  const end = path.getPointAtLength(length);
  return {
    start: { x: box.left + start.x * scaleX, y: box.top + start.y * scaleY },
    end: { x: box.left + end.x * scaleX, y: box.top + end.y * scaleY },
  };
}

const family: DepartmentChartDto = {
  organizationName: "Báo Tuổi Trẻ",
  myDepartmentIds: [],
  departments: [
    node({ id: 1, name: "Ban Giám đốc", childCount: 3 }),
    node({ id: 2, name: "Phòng A", parentId: 1, childCount: 1 }),
    node({ id: 3, name: "Phòng B", parentId: 1 }),
    node({ id: 4, name: "Phòng C", parentId: 1 }),
    node({ id: 5, name: "Phòng A1", parentId: 2 }),
  ],
};

/** The connector paths drawn directly under the card of `parentId` (not the ones of its descendants). */
function connectorsOf(parentId: number) {
  const row = document.querySelector(`[data-department-id="${parentId}"]`)?.parentElement?.lastElementChild;
  const svg = row?.firstElementChild;
  return svg instanceof SVGSVGElement ? Array.from(svg.querySelectorAll<SVGPathElement>("path[data-connector-for]")) : [];
}

test("each child hangs from its parent by a curve that ends on the top centre of its card", async () => {
  await render(<Harness onMenuAction={vi.fn()} data={family} />);
  await vi.waitFor(() => expect(connectorsOf(1)).toHaveLength(3), { timeout: 5000 });
  const parent = document.querySelector('[data-department-id="1"]')!.getBoundingClientRect();
  const add = document.querySelector<HTMLElement>('button[aria-label="Thêm phòng ban con vào Ban Giám đốc"]')!.getBoundingClientRect();
  for (const path of connectorsOf(1)) {
    const child = document.querySelector(`[data-department-id="${path.dataset.connectorFor}"]`)!.getBoundingClientRect();
    const { start, end } = connectorEnds(path);
    expect(Math.abs(end.x - (child.left + child.width / 2))).toBeLessThan(2);
    expect(Math.abs(end.y - child.top)).toBeLessThan(2);
    // Starts at the bottom centre of the parent, under its "+" button.
    expect(Math.abs(start.x - (parent.left + parent.width / 2))).toBeLessThan(2);
    expect(Math.abs(start.y - add.bottom)).toBeLessThan(2);
    // A soft curve (a cubic Bezier), not an elbow, unless the child is right below the parent.
    expect(path.getAttribute("d")).toMatch(/^M[\d.]+ 0(C|V)/);
  }
  expect(connectorsOf(1).some((path) => path.getAttribute("d")!.includes("C"))).toBe(true);
});

test("a single child gets one straight vertical line", async () => {
  await render(<Harness onMenuAction={vi.fn()} data={family} />);
  await vi.waitFor(() => expect(connectorsOf(2)).toHaveLength(1));
  const [path] = connectorsOf(2);
  expect(path.getAttribute("d")).toMatch(/^M[\d.]+ 0V[\d.]+$/);
  const { start, end } = connectorEnds(path);
  expect(Math.abs(start.x - end.x)).toBeLessThan(1);
});

test("the connectors let the pointer through", async () => {
  await render(<Harness onMenuAction={vi.fn()} data={family} />);
  await vi.waitFor(() => expect(connectorsOf(1)).toHaveLength(3), { timeout: 5000 });
  for (const path of document.querySelectorAll<SVGPathElement>("path[data-connector-for]")) {
    expect(getComputedStyle(path).pointerEvents).toBe("none");
    expect(getComputedStyle(path.ownerSVGElement!).pointerEvents).toBe("none");
  }
});

test("the connectors follow the zoom", async () => {
  const screen = await render(<Harness onMenuAction={vi.fn()} data={family} />);
  await vi.waitFor(() => expect(connectorsOf(1)).toHaveLength(3), { timeout: 5000 });
  for (let i = 0; i < 3; i++) await screen.getByRole("button", { name: "Thu nhỏ" }).click();
  for (const path of connectorsOf(1)) {
    const child = document.querySelector(`[data-department-id="${path.dataset.connectorFor}"]`)!.getBoundingClientRect();
    const { end } = connectorEnds(path);
    expect(Math.abs(end.x - (child.left + child.width / 2))).toBeLessThan(2);
    expect(Math.abs(end.y - child.top)).toBeLessThan(2);
  }
});

test("collapsing a parent removes the connectors of its children", async () => {
  const screen = await render(<Harness onMenuAction={vi.fn()} data={family} />);
  await vi.waitFor(() => expect(document.querySelectorAll("path[data-connector-for]")).toHaveLength(5), { timeout: 5000 });
  await screen.getByRole("group", { name: "Ban Giám đốc" }).getByRole("button", { expanded: true }).click();
  // Only the organization's own connector to the top-level department is left.
  await vi.waitFor(() => expect(document.querySelectorAll("path[data-connector-for]")).toHaveLength(1), { timeout: 5000 });
  expect(connectorsOf(1)).toHaveLength(0);
});
