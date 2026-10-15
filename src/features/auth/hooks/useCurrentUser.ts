"use client";

import { useCallback } from "react";
import { useSelector } from "react-redux";
import { useGetCurrentUserQuery } from "@/shared/api/generated/portalApi";
import type { Permission } from "@/shared/auth/permissions";
import { selectSessionStatus } from "@/shared/session/sessionSlice";

const NO_PERMISSIONS: string[] = [];

/**
 * The signed-in user (profile, positions, roles) and their effective permissions.
 * `isAdministrator` is true for the built-in administrator account (it holds every permission and manages roles and
 * users); `mustChangePassword` is true while the account still has an administrator-issued temporary password, so the
 * app can force a password change first. Both default to false until the profile has loaded.
 */
export function useCurrentUser() {
  const isAuthenticated = useSelector(selectSessionStatus) === "authenticated";
  const { data, isLoading, isError, refetch } = useGetCurrentUserQuery(undefined, { skip: !isAuthenticated });

  const permissions = data?.permissions ?? NO_PERMISSIONS;
  const hasPermission = useCallback((permission: Permission) => permissions.includes(permission), [permissions]);

  const isAdministrator = data?.user.isAdministrator ?? false;
  const mustChangePassword = data?.user.mustChangePassword ?? false;

  return { user: data?.user, permissions, hasPermission, isAdministrator, mustChangePassword, isLoading, isError, refetch };
}
