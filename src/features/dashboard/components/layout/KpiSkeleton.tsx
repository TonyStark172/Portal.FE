import { Card, Skeleton } from "@heroui/react";
import { useLocale } from "@/shared/i18n";

/** Stands in for a `KpiWidget` of three figures while they load. */
export function KpiSkeleton() {
  const { t } = useLocale();
  return (
    <Card role="status" aria-label={t("dashboard.loadingStats")} className="gap-3 p-3 sm:p-4">
      <Skeleton className="h-5 w-32 rounded-md" />
      <div className="grid grid-cols-3 gap-4 rounded-2xl bg-default/50 p-4 max-sm:grid-cols-1">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-1/2 rounded-md" />
            <Skeleton className="h-7 w-1/3 rounded-md" />
          </div>
        ))}
      </div>
    </Card>
  );
}
