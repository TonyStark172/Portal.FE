"use client";

import { useState, type FormEvent } from "react";
import { TrashBin } from "@gravity-ui/icons";
import { Alert, Button, FieldError, Form, Input, Label, Skeleton, Switch, TextField, toast } from "@heroui/react";
import {
  useGetDepartmentQuery,
  useUpdateDepartmentMutation,
  type DepartmentDto,
  type DepartmentTreeNode,
} from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { subtreeIds } from "../../lib/departmentTree";
import { splitValidationErrors } from "../../lib/validationErrors";
import { DeleteDepartmentDialog } from "./DeleteDepartmentDialog";
import { ParentSelect } from "./ParentSelect";

type Props = {
  departmentId: number;
  tree: DepartmentTreeNode[];
  canUpdate: boolean;
  canDelete: boolean;
  /** After the department is deleted, so that nothing shows it any more. */
  onDeleted: () => void;
};

/** The selected department: its details (changed here when the viewer may), and deleting it or retiring it. */
export function DepartmentDetails({ departmentId, tree, canUpdate, canDelete, onDeleted }: Props) {
  const { t } = useLocale();
  const department = useGetDepartmentQuery({ id: departmentId });

  if (department.isError) {
    return (
      <Alert status="danger" role="alert">
        <Alert.Indicator />
        <Alert.Content><Alert.Description>{t("admin.departmentLoadError")}</Alert.Description></Alert.Content>
      </Alert>
    );
  }
  if (!department.data || department.data.id !== departmentId) return <Skeleton className="h-64 rounded-xl" />;

  // A fresh form whenever another department is shown, or this one changed on the server.
  const data = department.data;
  return (
    <DetailsForm key={`${data.id}:${data.originalName}:${data.code}:${data.parentId}:${data.isActive}`}
      department={data} tree={tree} canUpdate={canUpdate} canDelete={canDelete} onDeleted={onDeleted} />
  );
}

function DetailsForm({ department, tree, canUpdate, canDelete, onDeleted }: Omit<Props, "departmentId"> & { department: DepartmentDto }) {
  const { t } = useLocale();
  const [updateDepartment, { isLoading: isSaving }] = useUpdateDepartmentMutation();
  const [name, setName] = useState(department.originalName);
  const [code, setCode] = useState(department.code);
  const [parentId, setParentId] = useState<number | null>(department.parentId ?? null);
  const [isActive, setIsActive] = useState(department.isActive);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const save = (fields: Partial<{ isActive: boolean }> = {}) => updateDepartment({
    id: department.id,
    updateDepartmentCommand: { code: code.trim(), name: name.trim(), originalName: name.trim(), parentId, isActive, ...fields },
  }).unwrap();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUpdate) return;
    setFieldErrors({});
    setError(null);
    try {
      await save();
      toast.success(t("admin.departmentSaved"));
    } catch (failure) {
      const problem = toApiProblem(failure);
      const { fieldErrors: found, leftover } = splitValidationErrors(problem, ["originalName", "name", "code", "parentId"]);
      const { originalName, ...rest } = found;
      setFieldErrors(originalName ? { ...rest, name: originalName } : rest);
      if (leftover.length > 0) setError(leftover.join(" "));
      else if (Object.keys(found).length === 0) setError(problem.detail ?? t("common.genericError"));
    }
  }

  return (
    <section aria-label={t("admin.departmentDetails")} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pe-8">
        <h3 className="min-w-0 break-words text-lg font-semibold">{department.name}</h3>
        <p className="text-sm text-muted tabular-nums">
          {t("admin.departmentCounts")
            .replace("{members}", String(department.memberCount))
            .replace("{children}", String(department.childCount))}
        </p>
      </div>

      <Form className="flex flex-col gap-4" validationErrors={fieldErrors} onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="name" isRequired isReadOnly={!canUpdate} value={name} onChange={setName} variant="secondary">
            <Label>{t("admin.departmentName")}</Label>
            <Input />
            <FieldError />
          </TextField>
          <TextField name="code" isRequired isReadOnly={!canUpdate} value={code} onChange={setCode} variant="secondary">
            <Label>{t("admin.code")}</Label>
            <Input />
            <FieldError />
          </TextField>
        </div>
        <ParentSelect tree={tree} value={parentId} onChange={setParentId} excluded={subtreeIds(tree, department.id)} isDisabled={!canUpdate} />
        <Switch size="sm" isSelected={isActive} isDisabled={!canUpdate} onChange={setIsActive}>
          <Switch.Content>
            <Switch.Control><Switch.Thumb /></Switch.Control>
            <Label>{t("admin.departmentActive")}</Label>
          </Switch.Content>
        </Switch>
        {error && (
          <Alert status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
          </Alert>
        )}
        {(canUpdate || canDelete) && (
          <div className="flex flex-wrap gap-2">
            {canUpdate && <Button type="submit" isPending={isSaving}>{t("admin.save")}</Button>}
            {canDelete && (
              <Button variant="danger-soft" onPress={() => setIsDeleting(true)}>
                <TrashBin className="size-4" />
                {t("admin.deleteDepartment")}
              </Button>
            )}
          </div>
        )}
      </Form>

      {isDeleting && (
        <DeleteDepartmentDialog department={department} canUpdate={canUpdate} onDeleted={onDeleted} onClose={() => setIsDeleting(false)} />
      )}
    </section>
  );
}
