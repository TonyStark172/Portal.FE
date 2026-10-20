import { expect, test } from "vitest";
import { Permissions, type Permission } from "@/shared/auth/permissions";
import { adminPermissions, adminTabs, visibleAdminTabs, type AdminTab } from "./tabs";

const holding = (...granted: Permission[]) => (permission: Permission) => granted.includes(permission);

test("users for whoever may view users", () => {
  expect(visibleAdminTabs({ hasPermission: holding(), isAdministrator: false }).map((tab) => tab.id)).toEqual([]);
  expect(visibleAdminTabs({ hasPermission: holding(Permissions.Users.View), isAdministrator: false }).map((tab) => tab.id)).toEqual(["users"]);
});

test("the administrator holds every permission, so the menu entry (Users.View) is theirs too", () => {
  expect(adminPermissions).toContain(Permissions.Users.View);
});

test("a holder of Departments.View sees the Departments tab and the Administration menu", () => {
  const tabs = visibleAdminTabs({ hasPermission: holding(Permissions.Departments.View), isAdministrator: false });
  expect(tabs.map((tab) => tab.id)).toEqual(["departments"]);
  expect(adminPermissions).toContain(Permissions.Departments.View);
});

test("a holder of Positions.View sees the Positions tab and the Administration menu", () => {
  const tabs = visibleAdminTabs({ hasPermission: holding(Permissions.Positions.View), isAdministrator: false });
  expect(tabs.map((tab) => tab.id)).toEqual(["positions"]);
  expect(tabs[0].href).toBe("/admin/positions");
  expect(adminPermissions).toContain(Permissions.Positions.View);
});

test("the administrator sees all four tabs, Roles & permissions last", () => {
  const tabs = visibleAdminTabs({ hasPermission: () => true, isAdministrator: true });
  expect(tabs.map((tab) => tab.id)).toEqual(["users", "departments", "positions", "roles"]);
  expect(tabs[3].href).toBe("/admin/roles");
});

test("someone who is not the administrator never sees Roles & permissions, whatever they hold", () => {
  const tabs = visibleAdminTabs({ hasPermission: () => true, isAdministrator: false });
  expect(tabs.map((tab) => tab.id)).toEqual(["users", "departments", "positions"]);
});

test("a tab marked for the administrator is the administrator's alone, whatever else is held", () => {
  const tabs: AdminTab[] = [...adminTabs, { id: "test-only" as AdminTab["id"], labelKey: "admin.test", href: "/admin/test", administrator: true }];
  const ids = (isAdministrator: boolean) =>
    visibleAdminTabs({ hasPermission: () => true, isAdministrator }, tabs).map((tab) => tab.href);
  expect(ids(false)).not.toContain("/admin/test");
  expect(ids(true)).toContain("/admin/test");
});
