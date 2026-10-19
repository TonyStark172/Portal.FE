import { Permissions, type Permission } from "@/shared/auth/permissions";

export type AdminTab = {
  id: "users" | "departments" | "roles";
  labelKey: string;
  href: string;
  /** Needed to see the tab; `administrator` tabs are the administrator's alone (granting permissions). */
  permission?: Permission;
  administrator?: boolean;
};

/** The administration tabs, in order. Positions and organization come in phase 2. */
export const adminTabs: AdminTab[] = [
  { id: "users", labelKey: "admin.users", href: "/admin/users", permission: Permissions.Users.View },
  { id: "departments", labelKey: "admin.departments", href: "/admin/departments", permission: Permissions.Departments.View },
  { id: "roles", labelKey: "admin.roles", href: "/admin/roles", administrator: true },
];

/** Holding any of these shows Administration in the menu (the administrator holds them all). */
export const adminPermissions: Permission[] = [Permissions.Users.View, Permissions.Departments.View];

type Access = { hasPermission: (permission: Permission) => boolean; isAdministrator: boolean };

export const visibleAdminTabs = ({ hasPermission, isAdministrator }: Access) =>
  adminTabs.filter((tab) => (tab.administrator ? isAdministrator : !tab.permission || hasPermission(tab.permission)));
