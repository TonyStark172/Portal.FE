import type { ComponentType, SVGProps } from "react";
import { House } from "@gravity-ui/icons";
import type { Permission } from "@/shared/auth/permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Hidden from users without this permission. */
  permission?: Permission;
};

/** Sidebar menu. Add an entry here when a new feature page is created. */
export const navigation: NavItem[] = [{ label: "Trang chủ", href: "/", icon: House }];
