"use client";

import { Button, Modal, toast } from "@heroui/react";
import { useLocale } from "@/shared/i18n";

type Props = {
  /** The password the server generated: it is shown here and kept nowhere else (the caller clears it on close). */
  password: string;
  /** Whose password it is, for the title. */
  fullName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Shows a temporary password exactly once, with a button to copy it. Nothing here stores or logs it. It does not close
 * by a click outside or Escape (either would lose the password by accident): only "Xong" and the close button do.
 * When the clipboard cannot be written, the password stays on screen to be copied by hand.
 */
export function TemporaryPasswordDialog({ password, fullName, isOpen, onOpenChange }: Props) {
  const { t } = useLocale();

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      toast.success(t("admin.copied"));
    } catch {
      toast.danger(t("admin.copyFailed"));
    }
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={false} isKeyboardDismissDisabled>
      <Modal.Container size="sm" placement="center">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("admin.close")} />
          <Modal.Header>
            <Modal.Heading>{t("admin.temporaryPasswordTitle").replace("{name}", fullName)}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3 p-1">
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 select-all break-all rounded-lg bg-default px-3 py-2 font-mono text-base tracking-wide">
                {password}
              </code>
              <Button variant="secondary" onPress={() => void copy()}>
                {t("admin.copy")}
              </Button>
            </div>
            <p className="text-sm text-muted">{t("admin.temporaryPasswordNote")}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close">{t("admin.done")}</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
