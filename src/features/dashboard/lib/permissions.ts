import { Permissions, type Permission } from "@/shared/auth/permissions";

/**
 * "Phân tích" (analytics) has one tab per area, each with its own Dashboard.* permission granted by administrators
 * through roles: holding any of them shows the page in the menu. The order is the tabs' (see `tabs.ts`).
 */
export const analyticsPermissions: Permission[] = [Permissions.Dashboard.Staff, Permissions.Dashboard.Meetings];

/** "Nhân sự" (HR), the staff list, is built on the staff figures: Dashboard.Staff. */
export const hrPermissions: Permission[] = [Permissions.Dashboard.Staff];
