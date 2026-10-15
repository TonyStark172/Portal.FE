import { expect, test } from "vitest";
import { Permissions, type Permission } from "@/shared/auth/permissions";
import { adminPermissions, visibleAdminTabs } from "./tabs";

const holding = (...granted: Permission[]) => (permission: Permission) => granted.includes(permission);

test("users for whoever may view users; roles for the administrator only", () => {
  expect(visibleAdminTabs({ hasPermission: holding(), isAdministrator: false }).map((tab) => tab.id)).toEqual([]);
  expect(visibleAdminTabs({ hasPermission: holding(Permissions.Users.View), isAdministrator: false }).map((tab) => tab.id)).toEqual(["users"]);
  expect(visibleAdminTabs({ hasPermission: holding(Permissions.Users.View), isAdministrator: true }).map((tab) => tab.id)).toEqual(["users", "roles"]);
});

test("the administrator holds every permission, so the menu entry (Users.View) is theirs too", () => {
  expect(adminPermissions).toContain(Permissions.Users.View);
});
