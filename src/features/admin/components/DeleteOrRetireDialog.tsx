"use client";

import { useState } from "react";
import { Alert, AlertDialog, Button } from "@heroui/react";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";

type Props = {
  title: string;
  /** Whether the thing can go: nobody holds it (now or in the history of people who left), nothing hangs under it. */
  canDelete: boolean;
  /** What is asked when it can go. */
  confirmText: string;
  /** Why it cannot, and that it can be retired instead. */
  blockedText: string;
  /** The label of the retire button ("Ngừng hoạt động", "Ngừng sử dụng"). */
  retireLabel: string;
  onDelete: () => Promise<unknown>;
  /** Retires it instead (it stays, marked inactive); absent when the viewer may not, or it already is. */
  onRetire?: () => Promise<unknown>;
  onClose: () => void;
};

/**
 * Deleting a department or a position: what can go is confirmed; what cannot (people hold it, or held it before
 * leaving: their history keeps it) is explained, with retiring it offered instead. The server's refusal of either is
 * shown inside the dialog. While a request is on its way the dialog cannot be dismissed.
 */
export function DeleteOrRetireDialog({ title, canDelete, confirmText, blockedText, retireLabel, onDelete, onRetire, onClose }: Props) {
  const { t } = useLocale();
  const [pending, setPending] = useState<"delete" | "retire" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "delete" | "retire", send: () => Promise<unknown>) {
    setError(null);
    setPending(action);
    try {
      await send();
      onClose();
    } catch (failure) {
      setError(toApiProblem(failure).detail ?? t("common.genericError"));
      setPending(null);
    }
  }

  const busy = pending !== null;
  return (
    <AlertDialog.Backdrop isOpen isDismissable={!busy} isKeyboardDismissDisabled={busy} onOpenChange={(open) => !open && !busy && onClose()}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-sm">
          <AlertDialog.Header>
            <AlertDialog.Icon status={canDelete ? "danger" : "warning"} />
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3">
            <p>{canDelete ? confirmText : blockedText}</p>
            {error && (
              <Alert status="danger" role="alert">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary" isDisabled={busy}>
              {t("admin.cancel")}
            </Button>
            {!canDelete && onRetire && (
              <Button variant="secondary" isPending={pending === "retire"} isDisabled={busy} onPress={() => void run("retire", onRetire)}>
                {retireLabel}
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" isPending={pending === "delete"} isDisabled={busy} onPress={() => void run("delete", onDelete)}>
                {t("admin.delete")}
              </Button>
            )}
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
