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
