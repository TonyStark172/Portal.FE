"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, FieldError, Form, Input, Label, Modal, TextArea, TextField, toast } from "@heroui/react";
import {
  useCreateRoleMutation,
  useUpdateRoleMutation,
  type PermissionGroupDto,
} from "@/shared/api/generated/portalApi";
import { ErrorCodes, toApiProblem, toFieldErrors } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { PermissionChecklist } from "./PermissionChecklist";

const FORM_ID = "role-form";

/** The fields a validation error can be shown under (`permissions` has no input of its own: it is shown below the list). */
const shownFields: Record<string, true> = { name: true, description: true, permissions: true };

/** What the dialog starts from. `id` is null for a role that does not exist yet (a new one, or a copy). */
export type RoleDraft = {
  id: number | null;
  name: string;
  description: string;
  permissions: string[];
  /** The administrator's role: shown, never changed. */
  readOnly: boolean;
};

type Props = {
  draft: RoleDraft;
  groups: PermissionGroupDto[];
  onClose: () => void;
};

/**
 * Creates a role, or edits one, or (read-only) shows the administrator's: a name, a description and the permission
 * checklist. The parent mounts it with a fresh `key` each time it opens, so its state always starts from `draft`.
 * The server's refusals of a field (a name already taken…) show under that field; any other refusal shows in an alert.
 */
export function RoleDialog({ draft, groups, onClose }: Props) {
  const { t } = useLocale();
  const [createRole, { isLoading: isCreating }] = useCreateRoleMutation();
  const [updateRole, { isLoading: isUpdating }] = useUpdateRoleMutation();
  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [permissions, setPermissions] = useState(draft.permissions);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.readOnly) return;
    setFieldErrors({});
    setError(null);

    const body = { name: name.trim(), description: description.trim() || null, permissions };
    try {
      if (draft.id === null) await createRole({ createRoleCommand: body }).unwrap();
      else await updateRole({ id: draft.id, updateRoleCommand: body }).unwrap();
      toast.success(t("admin.roleSaved"));
      onClose();
    } catch (failure) {
      const problem = toApiProblem(failure);
      const fields = problem.code === ErrorCodes.validationFailed ? toFieldErrors(problem) : {};
      // Field errors only help where there is a field to show them under.
      const shown = Object.fromEntries(Object.entries(fields).filter(([field]) => field in shownFields));
      if (Object.keys(shown).length > 0) setFieldErrors(shown);
      else setError(problem.detail ?? t("common.genericError"));
    }
  }

  const title = draft.readOnly ? t("admin.viewRole") : draft.id === null ? t("admin.createRole") : t("admin.editRole");
  const isPending = isCreating || isUpdating;

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container size="lg" placement="center" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("admin.close")} />
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-4 p-1">
            <Form id={FORM_ID} className="flex flex-col gap-4" validationErrors={fieldErrors} onSubmit={submit}>
              <TextField name="name" isRequired isReadOnly={draft.readOnly} autoFocus={!draft.readOnly} value={name} onChange={setName} variant="secondary">
                <Label>{t("admin.roleName")}</Label>
                <Input />
                <FieldError />
              </TextField>
              <TextField name="description" isReadOnly={draft.readOnly} value={description} onChange={setDescription} variant="secondary">
                <Label>{t("admin.roleDescription")}</Label>
                <TextArea rows={2} />
                <FieldError />
              </TextField>
            </Form>

            {draft.readOnly && (
              <Alert status="accent">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{t("admin.administratorRole")}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            <section aria-label={t("admin.rolePermissions")} className="flex flex-col gap-2">
              <PermissionChecklist groups={groups} value={permissions} onChange={setPermissions} isDisabled={draft.readOnly} />
              {fieldErrors.permissions && (
                <p role="alert" className="text-sm text-danger">
                  {fieldErrors.permissions.join(" ")}
                </p>
              )}
            </section>

            {error && (
              <Alert status="danger" role="alert">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button slot="close" variant="secondary">
              {draft.readOnly ? t("admin.close") : t("admin.cancel")}
            </Button>
            {!draft.readOnly && (
              <Button type="submit" form={FORM_ID} isPending={isPending}>
                {t("admin.save")}
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
