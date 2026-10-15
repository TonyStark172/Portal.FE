"use client";

import type { ReactNode } from "react";
import { Spinner } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import type { Permission } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { AdminNoAccess } from "./AdminNoAccess";

type Props = {
  /** Needed to open the page; the administrator holds every permission. */
  permission: Permission;
  /** The page itself: rendered (and its requests sent) only once the viewer is known to hold `permission`. */
  children: ReactNode;
};

/**
 * Shows an administration page only to whoever holds its permission: a spinner while the viewer is being read, the
 * no-access notice to anyone else (someone typing the URL). The back end refuses them too; this only spares the
 * requests and the errors.
 */
export function AdminGate({ permission, children }: Props) {
  const { hasPermission, isLoading } = useCurrentUser();
  const { t } = useLocale();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner aria-label={t("admin.opening")} />
      </div>
    );
  }
  if (!hasPermission(permission)) return <AdminNoAccess />;

  return <>{children}</>;
}
