"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { useLocale } from "@/shared/i18n";
import { visibleAdminTabs } from "../lib/tabs";
import { AdminNoAccess } from "./AdminNoAccess";

/** /admin opens the first tab the user may view. */
export function AdminIndex() {
  const router = useRouter();
  const { hasPermission, isAdministrator, isLoading } = useCurrentUser();
  const { t } = useLocale();
  const first = visibleAdminTabs({ hasPermission, isAdministrator })[0];

  useEffect(() => {
    if (!isLoading && first) router.replace(first.href);
  }, [isLoading, first, router]);

  if (!isLoading && !first) return <AdminNoAccess />;

  return (
    <div className="flex justify-center py-10">
      <Spinner aria-label={t("admin.opening")} />
    </div>
  );
}
