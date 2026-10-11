"use client";

import { useLocale } from "@/shared/i18n";

/** Placeholder until account settings get their screens. */
export default function SettingsPage() {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold">{t("common.settings")}</h1>
      <p className="text-muted">{t("common.settingsBuilding")}</p>
    </div>
  );
}
