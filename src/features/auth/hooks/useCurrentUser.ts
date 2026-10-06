"use client";

import { useCallback } from "react";
import { useSelector } from "react-redux";
import { useGetCurrentUserQuery } from "@/shared/api/generated/portalApi";
import type { Permission } from "@/shared/auth/permissions";
import { selectSessionStatus } from "@/shared/session/sessionSlice";

const NO_PERMISSIONS: string[] = [];

/** The signed-in user (profile, positions, roles) and their effective permissions. */
export function useCurrentUser() {
  const isAuthenticated = useSelector(selectSessionStatus) === "authenticated";
  const { data, isLoading, isError, refetch } = useGetCurrentUserQuery(undefined, { skip: !isAuthenticated });

  const permissions = data?.permissions ?? NO_PERMISSIONS;
  const hasPermission = useCallback((permission: Permission) => permissions.includes(permission), [permissions]);

  return { user: data?.user, permissions, hasPermission, isLoading, isError, refetch };
}
