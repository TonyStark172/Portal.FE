"use client";

import { Skeleton } from "@heroui/react";
import { useLocale } from "@/shared/i18n";

/** Placeholder rows shaped like `NotificationRow`: shown while the first rows load and while more are coming. */
export function NotificationSkeleton({ count = 5 }: { count?: number }) {
  const { t } = useLocale();
  return (
    <div role="status" aria-label={t("common.loading")} className="flex flex-col">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-11/12 rounded-md" />
            <Skeleton className="h-3 w-2/3 rounded-md" />
            <Skeleton className="h-3 w-1/4 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
