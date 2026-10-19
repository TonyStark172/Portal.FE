import { Permissions, type Permission } from "@/shared/auth/permissions";

export type AdminTab = {
  id: "users" | "departments" | "positions";
  labelKey: string;
  href: string;
  /** Needed to see the tab; `administrator` tabs are the administrator's alone (granting permissions). */
  permission?: Permission;
  administrator?: boolean;
};

/**
 * The administration tabs, in order. The roles page (/admin/roles) is left out of the bar on purpose: it stays in the
 * code and answers its URL, but nothing links to it.
 */
export const adminTabs: AdminTab[] = [
  { id: "users", labelKey: "admin.users", href: "/admin/users", permission: Permissions.Users.View },
  { id: "departments", labelKey: "admin.departments", href: "/admin/departments", permission: Permissions.Departments.View },
  { id: "positions", labelKey: "admin.positions", href: "/admin/positions", permission: Permissions.Positions.View },
];

/** Holding any of these shows Administration in the menu (the administrator holds them all). */
export const adminPermissions: Permission[] = [Permissions.Users.View, Permissions.Departments.View, Permissions.Positions.View];

type Access = { hasPermission: (permission: Permission) => boolean; isAdministrator: boolean };

/** The tabs this viewer may see, in order (`tabs` is for tests: it defaults to the real ones). */
export const visibleAdminTabs = ({ hasPermission, isAdministrator }: Access, tabs: AdminTab[] = adminTabs) =>
  tabs.filter((tab) => (tab.administrator ? isAdministrator : !tab.permission || hasPermission(tab.permission)));
