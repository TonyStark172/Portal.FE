"use client";

import { useState } from "react";
import { Alert, AlertDialog, Button, toast } from "@heroui/react";
import {
  useDeleteDepartmentMutation,
  useSetDepartmentActiveMutation,
  type DepartmentChartNode,
} from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import "../../api";

/** What the server says (in Vietnamese) when sub-departments block a delete; deactivating would not help then. */
const HAS_CHILDREN_PREFIX = "Phòng ban đang có phòng ban con";

type Props = {
  department: DepartmentChartNode;
  /** The viewer may deactivate (Departments.Update), so the dialog may offer it after a refusal. */
  canDeactivate: boolean;
  /** The department is gone (the parent clears the panel when it was the selected one) and the dialog closes itself. */
  onDeleted: (id: number) => void;
  onClose: () => void;
};

/**
 * Deletes a department. First it only asks; the server decides whether the department may go. A refusal (409) is shown
 * as the server worded it (sub-departments, active staff, or only people who left), and when the department is still
 * active and the refusal is not about sub-departments, "Ngừng hoạt động" is offered instead: deactivating keeps its
 * history and stops it receiving people. That call can be refused too (its sub-departments must be deactivated first),
 * and then its reason replaces the first one. Any other failure (the connection, a server error) is not the server's
 * answer about this department, so it is shown above the same buttons and the action can be tried again.
 * The parent mounts it per department, so nothing carries over.
 */
export function DeleteDepartmentDialog({ department, canDeactivate, onDeleted, onClose }: Props) {
  const { t } = useLocale();
  const [deleteDepartment, deleting] = useDeleteDepartmentMutation();
  const [setActive, deactivating] = useSetDepartmentActiveMutation();
  // Set once the server refused: what it said, and whether deactivating is worth offering.
  const [refusal, setRefusal] = useState<{ detail: string; canDeactivate: boolean } | null>(null);
  // A failure that is not a refusal (nothing was decided): shown while the buttons stay as they were.
  const [failure, setFailure] = useState<string | null>(null);
  const isPending = deleting.isLoading || deactivating.isLoading;

  async function remove() {
    setFailure(null);
    try {
      await deleteDepartment({ id: department.id }).unwrap();
    } catch (error) {
      const problem = toApiProblem(error);
      const detail = problem.detail ?? t("common.genericError");
      if (problem.status !== 409) {
        setFailure(detail);
        return;
      }
      setRefusal({
        detail,
        canDeactivate: canDeactivate && department.isActive && !detail.startsWith(HAS_CHILDREN_PREFIX),
      });
      return;
    }
    toast.success(t("departments.toast.deleted"));
    onDeleted(department.id);
    onClose();
  }

  async function deactivate() {
    try {
      await setActive({ id: department.id, setDepartmentActiveCommand: { isActive: false } }).unwrap();
    } catch (error) {
      const problem = toApiProblem(error);
      // A refusal (409) is final, so its reason replaces the offer; any other failure keeps the button to try again.
      setRefusal({ detail: problem.detail ?? t("common.genericError"), canDeactivate: problem.status !== 409 });
      return;
    }
    toast.success(t("departments.toast.deactivated"));
    onClose();
  }

  return (
    // Once a request is on its way it cannot be called back, so "no" (Huỷ, Escape, a click outside) is no longer offered.
    <AlertDialog.Backdrop isOpen isDismissable={!isPending} isKeyboardDismissDisabled={isPending} onOpenChange={(isOpen) => !isOpen && !isPending && onClose()}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-sm">
          <AlertDialog.Header>
            <AlertDialog.Icon status={refusal ? "warning" : "danger"} />
            <AlertDialog.Heading>{t("departments.delete.title").replace("{name}", department.name)}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3">
            {refusal ? (
              <Alert status="warning" role="alert">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{refusal.detail}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : (
              <>
                <p>{t("departments.delete.message")}</p>
                {failure && (
                  <Alert status="danger" role="alert">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>{failure}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}
              </>
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary" isDisabled={isPending}>
              {refusal ? t("admin.close") : t("admin.cancel")}
            </Button>
            {refusal ? (
              refusal.canDeactivate && (
                <Button variant="primary" isPending={deactivating.isLoading} onPress={() => void deactivate()}>
                  {t("departments.action.deactivate")}
                </Button>
              )
            ) : (
              <Button variant="danger" isPending={deleting.isLoading} onPress={() => void remove()}>
                {t("admin.delete")}
              </Button>
            )}
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
