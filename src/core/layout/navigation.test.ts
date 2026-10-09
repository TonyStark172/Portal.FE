import { describe, expect, test } from "vitest";
import { Permissions, type Permission } from "@/shared/auth/permissions";
import { isNavItemActive, isNavItemVisible, type NavItem } from "./navigation";

const item = (href: string, permission?: NavItem["permission"]): NavItem => ({ label: href, href, icon: () => null, permission });

describe("navigation", () => {
  test("highlights a section on its own page and on the pages under it", () => {
    expect(isNavItemActive(item("/dashboard"), "/dashboard")).toBe(true);
    expect(isNavItemActive(item("/dashboard"), "/dashboard/staff")).toBe(true);
    expect(isNavItemActive(item("/dashboard"), "/dashboards")).toBe(false);
  });

  test("highlights home only on the home page", () => {
    expect(isNavItemActive(item("/"), "/")).toBe(true);
    expect(isNavItemActive(item("/"), "/dashboard")).toBe(false);
  });

  test("shows an entry needing any of several permissions when one is held", () => {
    const has = (permission: Permission) => permission === Permissions.Dashboard.Staff;

    expect(isNavItemVisible(item("/dashboard", [Permissions.Posts.Manage, Permissions.Dashboard.Staff]), has)).toBe(true);
    expect(isNavItemVisible(item("/dashboard", [Permissions.Posts.Manage]), has)).toBe(false);
    expect(isNavItemVisible(item("/"), has)).toBe(true);
  });
});
