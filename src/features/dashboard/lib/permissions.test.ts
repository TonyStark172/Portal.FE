import { describe, expect, test } from "vitest";
import { Permissions } from "@/shared/auth/permissions";
import { dashboardPermissions } from "./permissions";

describe("dashboard permissions", () => {
  test("the staff figures, whether as statistics or as the staff list, need Dashboard.Staff", () => {
    expect(dashboardPermissions).toEqual([Permissions.Dashboard.Staff]);
  });
});
