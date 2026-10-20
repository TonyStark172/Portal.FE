import { describe, expect, test } from "vitest";
import { Permissions, type Permission } from "@/shared/auth/permissions";
import { analyticsTabFor, visibleAnalyticsTabs } from "./tabs";

const granted = (...permissions: Permission[]) => (permission: Permission) => permissions.includes(permission);

describe("the analytics tabs", () => {
  test("shows the HR tab first, at /dashboard, then the meetings tab, to whoever holds both", () => {
    expect(visibleAnalyticsTabs(granted(Permissions.Dashboard.Staff, Permissions.Dashboard.Meetings)).map((tab) => [tab.id, tab.href])).toEqual([
      ["staff", "/dashboard"],
      ["meetings", "/dashboard/meetings"],
    ]);
  });

  test("shows only the tab whose permission is held", () => {
    expect(visibleAnalyticsTabs(granted(Permissions.Dashboard.Staff)).map((tab) => tab.id)).toEqual(["staff"]);
    expect(visibleAnalyticsTabs(granted(Permissions.Dashboard.Meetings)).map((tab) => tab.id)).toEqual(["meetings"]);
  });

  test("shows no tab without either permission", () => {
    expect(visibleAnalyticsTabs(granted(Permissions.Posts.Create))).toEqual([]);
  });

  test("tells which tab a path is: /dashboard is the HR tab, though every tab's path starts with it", () => {
    expect(analyticsTabFor("/dashboard")?.id).toBe("staff");
    expect(analyticsTabFor("/dashboard/meetings")?.id).toBe("meetings");
    expect(analyticsTabFor("/dashboard/meetings/")?.id).toBe("meetings");
    expect(analyticsTabFor("/dashboard/unknown")).toBeUndefined();
  });
});
