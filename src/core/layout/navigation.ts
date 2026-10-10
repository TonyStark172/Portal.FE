import type { ComponentType, SVGProps } from "react";
import { Calendar, ChartPie, House } from "@gravity-ui/icons";
import { dashboardPermissions } from "@/features/dashboard";
import type { Permission } from "@/shared/auth/permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Hidden from users without this permission (or without any of these). */
  permission?: Permission | Permission[];
};

/** Sidebar menu. Add an entry here when a new feature page is created. */
export const navigation: NavItem[] = [
  { label: "Trang chủ", href: "/", icon: House },
  { label: "Dashboard", href: "/dashboard", icon: ChartPie, permission: dashboardPermissions },
  { label: "Lịch họp", href: "/meetings", icon: Calendar },
];

export function isNavItemVisible(item: NavItem, hasPermission: (permission: Permission) => boolean) {
  if (!item.permission) return true;
  const required = Array.isArray(item.permission) ? item.permission : [item.permission];
  return required.some(hasPermission);
}

/** A section stays highlighted on the pages under it (e.g. the dashboard tabs). */
export const isNavItemActive = (item: NavItem, pathname: string) =>
  item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
