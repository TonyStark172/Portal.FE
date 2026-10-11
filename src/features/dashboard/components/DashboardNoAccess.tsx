import { Alert } from "@heroui/react";
import { useLocale } from "@/shared/i18n";

/** Shown instead of a dashboard tab to someone without its permission (the back end refuses it too). */
export function DashboardNoAccess() {
  const { t } = useLocale();
  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t("dashboard.noAccess")}</Alert.Title>
        <Alert.Description>{t("dashboard.contactAdmin")}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
