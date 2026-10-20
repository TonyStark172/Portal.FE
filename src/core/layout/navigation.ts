import type { ComponentType, SVGProps } from "react";
import { Calendar, ChartPie, Gear, House, Persons, Shield } from "@gravity-ui/icons";
import { adminPermissions } from "@/features/admin";
import { analyticsPermissions, hrPermissions } from "@/features/dashboard";
import type { Permission } from "@/shared/auth/permissions";

export type NavItem = {
  /** Vietnamese fallback kept for callers/tests that construct navigation items directly. */
  label: string;
  labelKey?: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Hidden from users without this permission (or without any of these). */
  permission?: Permission | Permission[];
};

/** Sidebar menu. Add an entry here when a new feature page is created. */
export const navigation: NavItem[] = [
  { label: "Trang chủ", labelKey: "nav.home", href: "/", icon: House },
  { label: "Phân tích", labelKey: "nav.analytics", href: "/dashboard", icon: ChartPie, permission: analyticsPermissions },
  { label: "Nhân sự", labelKey: "nav.hr", href: "/hr", icon: Persons, permission: hrPermissions },
  { label: "Lịch", labelKey: "nav.meetings", href: "/meetings", icon: Calendar },
  { label: "Quản trị", labelKey: "nav.admin", href: "/admin", icon: Shield, permission: adminPermissions },
];

/** Pages reached from the account menu, not the sidebar: they still name themselves in the top bar. */
export const accountPages: NavItem[] = [{ label: "Cài đặt", labelKey: "common.settings", href: "/settings", icon: Gear }];

export function isNavItemVisible(item: NavItem, hasPermission: (permission: Permission) => boolean) {
  if (!item.permission) return true;
  const required = Array.isArray(item.permission) ? item.permission : [item.permission];
  return required.some(hasPermission);
}

/** A section stays highlighted on the pages under it (e.g. the admin tabs). */
export const isNavItemActive = (item: NavItem, pathname: string) =>
  item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
