import { Permissions, type Permission } from "@/shared/auth/permissions";

export type DashboardTab = {
  id: string;
  label: string;
  href: string;
  /** Each tab has its own permission (Dashboard.*), granted by administrators through roles. */
  permission: Permission;
};

/**
 * The dashboard tabs, in order. To add one: create app/(portal)/dashboard/<tab>/page.tsx, add an entry here and a
 * Dashboard.* permission in Portal.BE (mirrored in shared/auth/permissions.ts).
 */
export const dashboardTabs: DashboardTab[] = [
  { id: "staff", label: "Nhân sự", href: "/dashboard/staff", permission: Permissions.Dashboard.Staff },
];

/** Holding any of these shows the dashboard in the menu. */
export const dashboardPermissions: Permission[] = dashboardTabs.map((tab) => tab.permission);

export const visibleDashboardTabs = (hasPermission: (permission: Permission) => boolean) =>
  dashboardTabs.filter((tab) => hasPermission(tab.permission));
