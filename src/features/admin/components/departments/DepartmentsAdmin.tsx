"use client";

import { Spinner } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { AdminNoAccess } from "../AdminNoAccess";
import "../../api";

/**
 * Departments: needs Departments.View, so anyone else typing /admin/departments gets the no-access notice. For now
 * this is only the shell (the guard and the page region); the org chart, the drawer and the dialogs come in the
 * following tasks.
 */
export function DepartmentsAdmin() {
  const { hasPermission, isLoading } = useCurrentUser();
  const { t } = useLocale();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner aria-label={t("admin.opening")} />
      </div>
    );
  }
  if (!hasPermission(Permissions.Departments.View)) return <AdminNoAccess />;

  return <section aria-label={t("admin.departments")} />;
}
