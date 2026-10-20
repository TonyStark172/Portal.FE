import { describe, expect, test } from "vitest";
import { Permissions } from "@/shared/auth/permissions";
import { analyticsPermissions, hrPermissions } from "./permissions";

describe("dashboard permissions", () => {
  test("the analytics page shows to whoever may see one of its tabs: the staff or the meeting analytics", () => {
    expect(analyticsPermissions).toEqual([Permissions.Dashboard.Staff, Permissions.Dashboard.Meetings]);
  });

  test("the staff list (HR) needs Dashboard.Staff alone", () => {
    expect(hrPermissions).toEqual([Permissions.Dashboard.Staff]);
  });
});
