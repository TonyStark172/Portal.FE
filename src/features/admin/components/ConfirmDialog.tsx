"use client";

import { AlertDialog, Button } from "@heroui/react";
import { useLocale } from "@/shared/i18n";

type ConfirmProps = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** A question to confirm before something that cannot be taken back. */
export function ConfirmDialog({ title, message, confirmLabel, danger, isPending, onConfirm, onClose }: ConfirmProps) {
  const { t } = useLocale();
  return (
    // Once the request is on its way it cannot be called back, so "no" (Huỷ, Escape, a click outside) is no longer offered.
    <AlertDialog.Backdrop isOpen isDismissable={!isPending} isKeyboardDismissDisabled={isPending} onOpenChange={(isOpen) => !isOpen && !isPending && onClose()}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-sm">
          <AlertDialog.Header>
            <AlertDialog.Icon status={danger ? "danger" : "warning"} />
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>{message}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary" isDisabled={isPending}>
              {t("admin.cancel")}
            </Button>
            <Button variant={danger ? "danger" : "primary"} isPending={isPending} onPress={onConfirm}>
              {confirmLabel}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
