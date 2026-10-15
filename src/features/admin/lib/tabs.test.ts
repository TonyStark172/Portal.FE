import { expect, test } from "vitest";
import { Permissions, type Permission } from "@/shared/auth/permissions";
import { adminPermissions, visibleAdminTabs } from "./tabs";

const holding = (...granted: Permission[]) => (permission: Permission) => granted.includes(permission);

test("each tab for whoever may view it, in order; roles for the administrator only", () => {
  const ids = (access: Parameters<typeof visibleAdminTabs>[0]) => visibleAdminTabs(access).map((tab) => tab.id);
  expect(ids({ hasPermission: holding(), isAdministrator: false })).toEqual([]);
  expect(ids({ hasPermission: holding(Permissions.Users.View), isAdministrator: false })).toEqual(["users"]);
  expect(ids({ hasPermission: holding(Permissions.Departments.View), isAdministrator: false })).toEqual(["departments"]);
  expect(ids({ hasPermission: holding(Permissions.Positions.View, Permissions.Users.View), isAdministrator: false })).toEqual(["positions", "users"]);
  expect(ids({ hasPermission: holding(Permissions.Organization.Update), isAdministrator: false })).toEqual(["organization"]);
  expect(ids({ hasPermission: () => true, isAdministrator: true })).toEqual(["organization", "departments", "positions", "users", "roles"]);
});

test("any of the tabs' permissions shows Administration in the menu", () => {
  expect(adminPermissions).toEqual(expect.arrayContaining([
    Permissions.Organization.Update, Permissions.Departments.View, Permissions.Positions.View, Permissions.Users.View,
  ]));
});

test("the administrator holds every permission, so the menu entry (Users.View) is theirs too", () => {
  expect(adminPermissions).toContain(Permissions.Users.View);
});
