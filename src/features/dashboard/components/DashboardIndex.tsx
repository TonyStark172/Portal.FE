"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { visibleDashboardTabs } from "../lib/tabs";
import { DashboardNoAccess } from "./DashboardNoAccess";

/** /dashboard opens the first tab the user may view. */
export function DashboardIndex() {
  const router = useRouter();
  const { hasPermission, isLoading } = useCurrentUser();
  const first = visibleDashboardTabs(hasPermission)[0];

  useEffect(() => {
    if (!isLoading && first) router.replace(first.href);
  }, [isLoading, first, router]);

  if (!isLoading && !first) return <DashboardNoAccess />;

  return (
    <div className="flex justify-center py-10">
      <Spinner aria-label="Đang mở tổng quan" />
    </div>
  );
}
