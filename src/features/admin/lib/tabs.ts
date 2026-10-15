import { Permissions, type Permission } from "@/shared/auth/permissions";

export type AdminTab = {
  id: "organization" | "departments" | "positions" | "users" | "roles";
  labelKey: string;
  href: string;
  /** Needed to see the tab; `administrator` tabs are the administrator's alone (granting permissions). */
  permission?: Permission;
  administrator?: boolean;
};

/** The administration tabs, in order: the company, its structure, then the people and what they may do. */
export const adminTabs: AdminTab[] = [
  { id: "organization", labelKey: "admin.organization", href: "/admin/organization", permission: Permissions.Organization.Update },
  { id: "departments", labelKey: "admin.departments", href: "/admin/departments", permission: Permissions.Departments.View },
  { id: "positions", labelKey: "admin.positions", href: "/admin/positions", permission: Permissions.Positions.View },
  { id: "users", labelKey: "admin.users", href: "/admin/users", permission: Permissions.Users.View },
  { id: "roles", labelKey: "admin.roles", href: "/admin/roles", administrator: true },
];

/** Holding any of these shows Administration in the menu (the administrator holds them all). */
export const adminPermissions: Permission[] = adminTabs.flatMap((tab) => (tab.permission ? [tab.permission] : []));

type Access = { hasPermission: (permission: Permission) => boolean; isAdministrator: boolean };

export const visibleAdminTabs = ({ hasPermission, isAdministrator }: Access) =>
  adminTabs.filter((tab) => (tab.administrator ? isAdministrator : !tab.permission || hasPermission(tab.permission)));
