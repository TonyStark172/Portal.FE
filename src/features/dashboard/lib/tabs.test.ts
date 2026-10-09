import { describe, expect, test } from "vitest";
import { Permissions, type Permission } from "@/shared/auth/permissions";
import { dashboardPermissions, visibleDashboardTabs } from "./tabs";

const granted = (...permissions: Permission[]) => (permission: Permission) => permissions.includes(permission);

describe("dashboard tabs", () => {
  test("shows only the tabs the user may view", () => {
    expect(visibleDashboardTabs(granted(Permissions.Dashboard.Staff)).map((t) => t.href)).toEqual(["/dashboard/staff"]);
    expect(visibleDashboardTabs(granted(Permissions.Posts.Create))).toEqual([]);
  });

  test("lists the permission of every tab, for the menu entry", () => {
    expect(dashboardPermissions).toContain(Permissions.Dashboard.Staff);
  });
});
