"use client";

import { Button } from "@heroui/react";
import { useLocale } from "@/shared/i18n";

/**
 * What the Departments page shows while there is no company yet (departments hang from the company, so there is no chart
 * to draw): a centred card that invites creating it, with the button only for someone who may (`onCreate` given), and
 * otherwise a note to ask an administrator.
 */
export function CompanySetupCard({ onCreate }: { onCreate?: () => void }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-border bg-surface-secondary px-6 py-12 text-center">
        {onCreate ? (
          <>
            <h3 className="text-base font-semibold">{t("departments.company.setupTitle")}</h3>
            <p className="text-sm text-muted">{t("departments.company.setupText")}</p>
            <Button onPress={onCreate}>{t("departments.company.create")}</Button>
          </>
        ) : (
          <p className="text-sm text-muted">{t("departments.company.setupContactAdmin")}</p>
        )}
      </div>
    </div>
  );
}
