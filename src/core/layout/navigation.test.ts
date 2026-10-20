import { describe, expect, test } from "vitest";
import { Permissions, type Permission } from "@/shared/auth/permissions";
import { isNavItemActive, isNavItemVisible, navigation, type NavItem } from "./navigation";

const item = (href: string, permission?: NavItem["permission"]): NavItem => ({ label: href, href, icon: () => null, permission });

describe("navigation", () => {
  test("highlights a section on its own page and on the pages under it", () => {
    expect(isNavItemActive(item("/dashboard"), "/dashboard")).toBe(true);
    expect(isNavItemActive(item("/admin"), "/admin/users")).toBe(true);
    expect(isNavItemActive(item("/dashboard"), "/dashboards")).toBe(false);
  });

  test("lists Phân tích and Nhân sự right after the home page, each on its own page", () => {
    expect(navigation.slice(0, 3).map((entry) => [entry.labelKey, entry.href])).toEqual([
      ["nav.home", "/"],
      ["nav.analytics", "/dashboard"],
      ["nav.hr", "/hr"],
    ]);
    const [analytics, hr] = [navigation[1], navigation[2]];
    expect(isNavItemActive(analytics, "/dashboard")).toBe(true);
    expect(isNavItemActive(analytics, "/hr")).toBe(false);
    expect(isNavItemActive(hr, "/hr")).toBe(true);
    expect(isNavItemActive(hr, "/dashboard")).toBe(false);
  });

  test("shows Phân tích and Nhân sự to whoever holds Dashboard.Staff, and hides them from everyone else", () => {
    for (const entry of [navigation[1], navigation[2]]) {
      expect(isNavItemVisible(entry, (permission) => permission === Permissions.Dashboard.Staff)).toBe(true);
      expect(isNavItemVisible(entry, (permission) => permission === Permissions.Users.View)).toBe(false);
    }
  });

  test("shows Phân tích, but not Nhân sự, to whoever holds Dashboard.Meetings alone", () => {
    const meetingsOnly = (permission: Permission) => permission === Permissions.Dashboard.Meetings;
    expect(isNavItemVisible(navigation[1], meetingsOnly)).toBe(true);
    expect(isNavItemVisible(navigation[2], meetingsOnly)).toBe(false);
  });

  test("keeps Phân tích highlighted on its meetings tab", () => {
    expect(isNavItemActive(navigation[1], "/dashboard/meetings")).toBe(true);
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

  test("shows Administration to whoever holds Users.View, and hides it from everyone else", () => {
    const admin = navigation.find((entry) => entry.href === "/admin");

    expect(admin).toBeDefined();
    expect(isNavItemVisible(admin!, (permission) => permission === Permissions.Users.View)).toBe(true);
    expect(isNavItemVisible(admin!, () => false)).toBe(false);
  });
});
