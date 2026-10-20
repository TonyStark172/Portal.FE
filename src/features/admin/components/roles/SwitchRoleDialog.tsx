"use client";

import { AlertDialog, Button } from "@heroui/react";
import { useLocale } from "@/shared/i18n";

type Props = {
  /** The role being left, which has unsaved changes. */
  roleName: string;
  changeCount: number;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onStay: () => void;
};

/**
 * Asked when another role is picked while the one shown has unsaved changes (one role is edited at a time): save them and
 * go on, drop them and go on, or stay. While the save is on its way nothing else can be chosen.
 */
export function SwitchRoleDialog({ roleName, changeCount, isSaving, onSave, onDiscard, onStay }: Props) {
  const { t } = useLocale();
  return (
    <AlertDialog.Backdrop isOpen isDismissable={!isSaving} isKeyboardDismissDisabled={isSaving} onOpenChange={(isOpen) => !isOpen && !isSaving && onStay()}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-md">
          <AlertDialog.Header>
            <AlertDialog.Icon status="warning" />
            <AlertDialog.Heading>{t("roles.switchTitle").replace("{role}", roleName)}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>{t("roles.switchMessage").replace("{count}", String(changeCount))}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer className="flex-wrap">
            <Button slot="close" variant="tertiary" isDisabled={isSaving}>
              {t("roles.stay")}
            </Button>
            <Button variant="danger-soft" isDisabled={isSaving} onPress={onDiscard}>
              {t("roles.discard")}
            </Button>
            <Button isPending={isSaving} onPress={onSave}>
              {t("admin.save")}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
