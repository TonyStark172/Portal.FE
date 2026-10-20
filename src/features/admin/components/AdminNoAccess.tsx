import { Alert } from "@heroui/react";
import { useLocale } from "@/shared/i18n";

/** Shown instead of an administration page to someone without its permission (the back end refuses it too). */
export function AdminNoAccess() {
  const { t } = useLocale();
  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t("admin.noAccess")}</Alert.Title>
      </Alert.Content>
    </Alert>
  );
}
