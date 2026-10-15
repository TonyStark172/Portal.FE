"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { WorkWeekEditor } from "@/features/settings";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { AdminGate } from "../AdminGate";
import { SettingsSection } from "../SettingsSection";
import { HandOverDialog } from "./HandOverDialog";
import { OrganizationDetailsForm } from "./OrganizationDetailsForm";
import { OrganizationDetailsSummary, WorkWeekSummary } from "./OrganizationSummary";

/**
 * The organization: its details and work week, for whoever may change the organization; and, for the administrator
 * alone, handing administration over to someone else. A settings page: one part per row, a line between them; on a
 * very wide screen each row ends with a summary of what that part has saved.
 */
export function OrganizationAdmin() {
  return (
    <AdminGate permission={Permissions.Organization.Update}>
      <OrganizationPage />
    </AdminGate>
  );
}

function OrganizationPage() {
  const { t } = useLocale();
  const { isAdministrator } = useCurrentUser();
  const [handingOver, setHandingOver] = useState(false);

  return (
    <>
      <div className="flex min-w-0 flex-col divide-y divide-separator">
        <SettingsSection title={t("admin.organizationDetails")} description={t("admin.organizationDetailsHint")}
          aside={<OrganizationDetailsSummary />}>
          <OrganizationDetailsForm />
        </SettingsSection>

        <SettingsSection title={t("settings.meetings.workWeek")} description={t("settings.meetings.workWeekHint")}
          aside={<WorkWeekSummary />}>
          <WorkWeekEditor framed={false} summary={false} />
        </SettingsSection>

        {isAdministrator && (
          <SettingsSection title={t("admin.dangerZone")} description={t("admin.dangerZoneHint")} tone="danger" aside={null}>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-danger/40 p-4">
              <p className="min-w-0 flex-1 text-sm text-muted">{t("admin.handOverHint")}</p>
              <Button variant="danger-soft" className="shrink-0" onPress={() => setHandingOver(true)}>{t("admin.handOver")}</Button>
            </div>
          </SettingsSection>
        )}
      </div>

      {handingOver && <HandOverDialog onClose={() => setHandingOver(false)} />}
    </>
  );
}
