"use client";

import type { ReactNode } from "react";
import type { Permission } from "@/shared/auth/permissions";
import { useCurrentUser } from "../hooks/useCurrentUser";

type CanProps = {
  permission: Permission;
  children: ReactNode;
  /** Rendered when the user lacks the permission. */
  fallback?: ReactNode;
};

/**
 * Shows its children only when the signed-in user has the permission, e.g.
 * `<Can permission={Permissions.Users.Create}><Button>Thêm người dùng</Button></Can>`.
 * This only hides the UI; the back end checks permissions on every request.
 */
export function Can({ permission, children, fallback = null }: CanProps) {
  const { hasPermission } = useCurrentUser();
  return hasPermission(permission) ? children : fallback;
}
