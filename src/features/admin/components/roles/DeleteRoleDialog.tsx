"use client";

import { useState } from "react";
import { useDispatch } from "react-redux";
import { Alert, AlertDialog, Button, Label, ListBox, Modal, Select, toast } from "@heroui/react";
import { portalApi, useDeleteRoleMutation, type RoleDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";

type Props = {
  role: RoleDto;
  /** Every role, to pick the replacement from. */
  roles: RoleDto[];
  onClose: () => void;
};

/**
 * Deletes a role. A role nobody holds is only confirmed; one people hold asks which role they move to (the other
 * roles but the administrator's, the default one preselected), because everyone must keep a role. The parent mounts
 * it with a fresh `key` each time it opens. A refusal shows in an alert inside the dialog.
 */
export function DeleteRoleDialog({ role, roles, onClose }: Props) {
  const { t } = useLocale();
  const dispatch = useDispatch();
  const [deleteRole, { isLoading }] = useDeleteRoleMutation();
  const candidates = roles.filter((other) => other.id !== role.id && !other.isAdmin);
  const [replacementId, setReplacementId] = useState<number | null>(
    () => (candidates.find((other) => other.isDefault) ?? candidates[0])?.id ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const hasHolders = role.userCount > 0;

  async function confirm() {
    setError(null);
    try {
      await deleteRole({ id: role.id, replacementRoleId: hasHolders ? (replacementId ?? undefined) : undefined }).unwrap();
      // The holders' roles changed, and the users list shows them.
      dispatch(portalApi.util.invalidateTags(["Users"]));
      toast.success(t("admin.roleDeleted"));
      onClose();
    } catch (failure) {
      setError(toApiProblem(failure).detail ?? t("common.genericError"));
    }
  }

  // Once the request is on its way it cannot be called back, so "no" (Huỷ, Escape, a click outside, the close button) is
  // no longer offered: a dismissed dialog would look as if the role was kept.
  const dismiss = (open: boolean) => !open && !isLoading && onClose();

  const title = t("admin.deleteRoleTitle").replace("{name}", role.name);
  const failure = error && (
    <Alert status="danger" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{error}</Alert.Description>
      </Alert.Content>
    </Alert>
  );

  if (!hasHolders) {
    return (
      <AlertDialog.Backdrop isOpen isDismissable={!isLoading} isKeyboardDismissDisabled={isLoading} onOpenChange={dismiss}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-sm">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>{title}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="flex flex-col gap-3">
              <p>{t("admin.deleteRoleConfirm")}</p>
              {failure}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary" isDisabled={isLoading}>
                {t("admin.cancel")}
              </Button>
              <Button variant="danger" isPending={isLoading} onPress={() => void confirm()}>
                {t("admin.delete")}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    );
  }

  return (
    <Modal.Backdrop isOpen isDismissable={!isLoading} isKeyboardDismissDisabled={isLoading} onOpenChange={dismiss}>
      <Modal.Container size="sm" placement="center">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("admin.close")} isDisabled={isLoading} />
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4 p-1">
            <p>{t("admin.deleteRoleMove").replace("{count}", String(role.userCount))}</p>
            <Select
              fullWidth
              selectedKey={replacementId === null ? null : String(replacementId)}
              onSelectionChange={(key) => key !== null && setReplacementId(Number(key))}
            >
              <Label className="sr-only">{t("admin.replacementRole")}</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {candidates.map((other) => (
                    <ListBox.Item id={String(other.id)} key={other.id} textValue={other.name}>
                      {other.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            {failure}
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary" isDisabled={isLoading}>
              {t("admin.cancel")}
            </Button>
            <Button variant="danger" isPending={isLoading} isDisabled={replacementId === null} onPress={() => void confirm()}>
              {t("admin.delete")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
