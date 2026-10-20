import { Permissions, type Permission } from "@/shared/auth/permissions";

export type AdminTab = {
  id: "users" | "departments" | "positions" | "roles";
  labelKey: string;
  href: string;
  /** Needed to see the tab; `administrator` tabs are the administrator's alone (granting permissions). */
  permission?: Permission;
  administrator?: boolean;
};

/**
 * The administration tabs, in order. Roles & permissions comes last and is the administrator's alone: permissions come
 * only from roles (nothing is granted per person, nor by a position on the department chart), so this is where they
 * are granted.
 */
export const adminTabs: AdminTab[] = [
  { id: "users", labelKey: "admin.users", href: "/admin/users", permission: Permissions.Users.View },
  { id: "departments", labelKey: "admin.departments", href: "/admin/departments", permission: Permissions.Departments.View },
  { id: "positions", labelKey: "admin.positions", href: "/admin/positions", permission: Permissions.Positions.View },
  { id: "roles", labelKey: "admin.roles", href: "/admin/roles", administrator: true },
];

/** Holding any of these shows Administration in the menu (the administrator holds them all). */
export const adminPermissions: Permission[] = [Permissions.Users.View, Permissions.Departments.View, Permissions.Positions.View];

type Access = { hasPermission: (permission: Permission) => boolean; isAdministrator: boolean };

/** The tabs this viewer may see, in order (`tabs` is for tests: it defaults to the real ones). */
export const visibleAdminTabs = ({ hasPermission, isAdministrator }: Access, tabs: AdminTab[] = adminTabs) =>
  tabs.filter((tab) => (tab.administrator ? isAdministrator : !tab.permission || hasPermission(tab.permission)));
