"use client";

import { Tabs } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { MeetingSettings } from "@/features/settings";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";

/**
 * Settings of the organization, one tab per area. Only those who may change the organization see them; everyone else
 * keeps the placeholder until account settings get their screens.
 */
export default function SettingsPage() {
  const { t } = useLocale();
  const { hasPermission } = useCurrentUser();
  if (!hasPermission(Permissions.Organization.Update)) {
    return (
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("common.settings")}</h1>
        <p className="text-muted">{t("common.settingsBuilding")}</p>
      </div>
    );
  }
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("common.settings")}</h1>
      <Tabs className="w-full">
        <Tabs.ListContainer className="w-fit max-w-full">
          <Tabs.List aria-label={t("common.settings")}>
            <Tabs.Tab id="meetings">{t("settings.meetings.tab")}<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="meetings" className="pt-4"><MeetingSettings /></Tabs.Panel>
      </Tabs>
    </section>
  );
}
