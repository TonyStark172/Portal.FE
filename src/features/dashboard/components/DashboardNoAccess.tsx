import { Alert } from "@heroui/react";

/** Shown instead of a dashboard tab to someone without its permission (the back end refuses it too). */
export function DashboardNoAccess() {
  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Bạn không có quyền xem mục này.</Alert.Title>
        <Alert.Description>Liên hệ quản trị viên nếu bạn cần xem số liệu này.</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
