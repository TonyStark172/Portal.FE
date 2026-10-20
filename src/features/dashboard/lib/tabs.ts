import { Permissions, type Permission } from "@/shared/auth/permissions";

export type AnalyticsTab = {
  id: "staff" | "meetings";
  labelKey: string;
  href: string;
  permission: Permission;
};

/**
 * The analytics tabs, in order; each is its own page under app/(portal)/dashboard, so it has a link of its own. The
 * staff analytics stay at /dashboard itself, where they have always been.
 */
export const analyticsTabs: AnalyticsTab[] = [
  { id: "staff", labelKey: "dashboard.staffTab", href: "/dashboard", permission: Permissions.Dashboard.Staff },
  { id: "meetings", labelKey: "dashboard.meetingsTab", href: "/dashboard/meetings", permission: Permissions.Dashboard.Meetings },
];

export const visibleAnalyticsTabs = (hasPermission: (permission: Permission) => boolean) =>
  analyticsTabs.filter((tab) => hasPermission(tab.permission));

const trimmed = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);

/** The tab a path shows: matched exactly, since every tab's path starts with the first one's (/dashboard). */
export const analyticsTabFor = (pathname: string) => analyticsTabs.find((tab) => tab.href === trimmed(pathname));
