import "@/app/globals.css";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import type { PermissionGroupDto, RoleDto } from "@/shared/api/generated/portalApi";
import { RolePermissionsPreview } from "./RolePermissionsPreview";

const role = (id: number, name: string, permissions: string[], extra: Partial<RoleDto> = {}): RoleDto => ({
  id, name, description: null, isAdmin: false, isDefault: false, permissions, userCount: 0, ...extra,
});

const groups: PermissionGroupDto[] = [
  { group: "Users", permissions: ["Users.View", "Users.Create"] },
  { group: "Posts", permissions: ["Posts.View", "Posts.Create"] },
];
const staff = role(2, "Nhân viên", ["Users.View"], { isDefault: true });
const accountant = role(3, "Kế toán", ["Posts.Create", "Users.View"]);
const administrator = role(1, "Administrator", [], { isAdmin: true });

test("lists the permissions of the chosen roles, grouped by module under the module name", async () => {
  const screen = await render(<RolePermissionsPreview groups={groups} roles={[staff, accountant]} roleIds={[2]} />);
  await expect.element(screen.getByText("Quyền của người này")).toBeVisible();
  await expect.element(screen.getByText("Tổng hợp từ các vai trò đã chọn. Quyền chỉ đến từ vai trò.")).toBeVisible();
  const users = screen.getByRole("group", { name: "Người dùng" });
  await expect.element(users).toHaveTextContent("Xem người dùng");
  await expect.element(users).not.toHaveTextContent("Tạo người dùng");
  // A module nothing was granted in is not listed.
  await expect.element(screen.getByRole("group", { name: "Bài viết" })).not.toBeInTheDocument();
});

test("the union of several roles: a shared permission shows once, groups follow the catalogue order", async () => {
  // Chosen in the reverse of the catalogue order, to show the order is the catalogue's.
  const screen = await render(<RolePermissionsPreview groups={groups} roles={[staff, accountant]} roleIds={[3, 2]} />);
  const modules = screen.getByRole("group").elements();
  expect(modules.map((element) => element.getAttribute("aria-label"))).toEqual(["Người dùng", "Bài viết"]);
  expect(screen.getByText("Xem người dùng").elements()).toHaveLength(1);
  await expect.element(screen.getByRole("group", { name: "Bài viết" })).toHaveTextContent("Đăng bài");
});

test("a code the catalogue does not list still shows, under its own prefix, as itself", async () => {
  const screen = await render(<RolePermissionsPreview groups={groups} roles={[role(4, "Mới", ["Reports.Export"])]} roleIds={[4]} />);
  await expect.element(screen.getByRole("group", { name: "Reports" })).toHaveTextContent("Reports.Export");
});

test("the administrator role says it holds everything, instead of listing", async () => {
  const screen = await render(<RolePermissionsPreview groups={groups} roles={[administrator, staff]} roleIds={[1, 2]} />);
  await expect.element(screen.getByText("Quản trị viên — có mọi quyền")).toBeVisible();
  await expect.element(screen.getByRole("group")).not.toBeInTheDocument();
});

test("no role chosen: nothing is held, and it says so", async () => {
  const screen = await render(<RolePermissionsPreview groups={groups} roles={[staff, accountant]} roleIds={[]} />);
  await expect.element(screen.getByText("Chưa có quyền nào — hãy chọn ít nhất một vai trò.")).toBeVisible();
  await expect.element(screen.getByRole("group")).not.toBeInTheDocument();
});

test("it is read-only: no boxes to tick", async () => {
  const screen = await render(<RolePermissionsPreview groups={groups} roles={[staff]} roleIds={[2]} />);
  await expect.element(screen.getByRole("checkbox")).not.toBeInTheDocument();
});

test("a chosen role the list does not know holds nothing", async () => {
  const screen = await render(<RolePermissionsPreview groups={groups} roles={[staff]} roleIds={[99]} />);
  await expect.element(screen.getByText("Chưa có quyền nào — hãy chọn ít nhất một vai trò.")).toBeVisible();
});
