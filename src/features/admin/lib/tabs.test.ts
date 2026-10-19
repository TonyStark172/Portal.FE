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

test("Positions comes after Departments, and the roles tab is no longer in the bar, even for the administrator", () => {
  const tabs = visibleAdminTabs({ hasPermission: () => true, isAdministrator: true });
  expect(tabs.map((tab) => tab.id)).toEqual(["users", "departments", "positions"]);
});

test("a tab marked for the administrator is the administrator's alone, whatever else is held", () => {
  const tabs: AdminTab[] = [...adminTabs, { id: "positions", labelKey: "admin.test", href: "/admin/test", administrator: true }];
  const ids = (isAdministrator: boolean) =>
    visibleAdminTabs({ hasPermission: () => true, isAdministrator }, tabs).map((tab) => tab.href);
  expect(ids(false)).not.toContain("/admin/test");
  expect(ids(true)).toContain("/admin/test");
});
