"use client";

import { AlertDialog, Button } from "@heroui/react";
import { useLocale } from "@/shared/i18n";

/** A question before something that cannot be taken back: recalling a message, leaving a group, deleting a conversation. */
export function ConfirmAction({ title, message, confirmLabel, isPending, onConfirm, onClose }: {
  title: string;
  message: string;
  confirmLabel: string;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  return (
    <AlertDialog.Backdrop isOpen isDismissable={!isPending} isKeyboardDismissDisabled={isPending} onOpenChange={(isOpen) => !isOpen && !isPending && onClose()}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-sm">
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>{message}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary" isDisabled={isPending}>{t("messages.cancel")}</Button>
            <Button variant="danger" isPending={isPending} onPress={onConfirm}>{confirmLabel}</Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
