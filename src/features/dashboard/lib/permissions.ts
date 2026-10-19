import { Permissions, type Permission } from "@/shared/auth/permissions";

/**
 * Both pages built on the staff figures — "Phân tích" (the statistics) and "Nhân sự" (the staff list) — need
 * Dashboard.Staff, granted by administrators through roles. Holding any of these shows them in the menu.
 */
export const dashboardPermissions: Permission[] = [Permissions.Dashboard.Staff];
