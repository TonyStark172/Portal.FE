"use client";

import { toast } from "@heroui/react";
import { useDeleteDepartmentMutation, useUpdateDepartmentMutation, type DepartmentDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { DeleteOrRetireDialog } from "../DeleteOrRetireDialog";

type Props = {
  department: DepartmentDto;
  /** Whether the viewer may retire it instead (an active department that cannot be deleted). */
  canUpdate: boolean;
  onDeleted: () => void;
  onClose: () => void;
};

/** Deleting a department: only an empty one; one with people or sub-departments can be made inactive instead. */
export function DeleteDepartmentDialog({ department, canUpdate, onDeleted, onClose }: Props) {
  const { t } = useLocale();
  const [deleteDepartment] = useDeleteDepartmentMutation();
  const [updateDepartment] = useUpdateDepartmentMutation();
  const retire = () => updateDepartment({
    id: department.id,
    updateDepartmentCommand: {
      code: department.code, name: department.originalName, originalName: department.originalName,
      parentId: department.parentId ?? null, isActive: false,
    },
  }).unwrap().then(() => toast.success(t("admin.departmentRetired")));

  return (
    <DeleteOrRetireDialog
      title={t("admin.deleteDepartmentTitle").replace("{name}", department.name)}
      canDelete={department.canDelete}
      confirmText={t("admin.deleteDepartmentConfirm")}
      blockedText={t("admin.departmentNotEmpty")}
      retireLabel={t("admin.retireDepartment")}
      onDelete={() => deleteDepartment({ id: department.id }).unwrap().then(() => {
        toast.success(t("admin.departmentDeleted"));
        onDeleted();
      })}
      onRetire={canUpdate && department.isActive ? retire : undefined}
      onClose={onClose}
    />
  );
}
