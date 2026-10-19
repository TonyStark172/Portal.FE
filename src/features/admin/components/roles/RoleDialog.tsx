"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, FieldError, Form, Input, Label, Modal, TextArea, TextField, toast } from "@heroui/react";
import { useCreateRoleMutation, useUpdateRoleMutation } from "@/shared/api/generated/portalApi";
import { ErrorCodes, toApiProblem, toFieldErrors } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";

const FORM_ID = "role-form";

/** The fields a validation error can be shown under. */
const shownFields: Record<string, true> = { name: true, description: true };

/**
 * What the dialog starts from. `id` is null for a role that does not exist yet. The permissions are not edited here (they
 * are ticked in the role's pane): they are what the role holds now, sent back unchanged when a role is renamed, and empty
 * for a new one.
 */
export type RoleDraft = {
  id: number | null;
  name: string;
  description: string;
  permissions: string[];
};

type Props = {
  draft: RoleDraft;
  /** Called with the role's id once it is saved (the new id for a role just created). */
  onSaved?: (id: number) => void;
  onClose: () => void;
};

/**
 * Creates a role, or renames one: a name and a description. The parent mounts it with a fresh `key` each time it opens, so
 * its state always starts from `draft`.
 * The server's refusals of a field (a name already taken…) show under that field; any other refusal shows in an alert.
 */
export function RoleDialog({ draft, onSaved, onClose }: Props) {
  const { t } = useLocale();
  const [createRole, { isLoading: isCreating }] = useCreateRoleMutation();
  const [updateRole, { isLoading: isUpdating }] = useUpdateRoleMutation();
  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setError(null);

    const body = { name: name.trim(), description: description.trim() || null, permissions: draft.permissions };
    try {
      const id = draft.id === null ? await createRole({ createRoleCommand: body }).unwrap() : draft.id;
      if (draft.id !== null) await updateRole({ id: draft.id, updateRoleCommand: body }).unwrap();
      toast.success(t("admin.roleSaved"));
      onSaved?.(id);
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

  const title = draft.id === null ? t("admin.createRole") : t("roles.rename");
  const isPending = isCreating || isUpdating;

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container size="md" placement="center" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("admin.close")} />
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-4 p-1">
            <Form id={FORM_ID} className="flex flex-col gap-4" validationErrors={fieldErrors} onSubmit={submit}>
              <TextField name="name" isRequired autoFocus value={name} onChange={setName} variant="secondary">
                <Label>{t("admin.roleName")}</Label>
                <Input />
                <FieldError />
              </TextField>
              <TextField name="description" value={description} onChange={setDescription} variant="secondary">
                <Label>{t("admin.roleDescription")}</Label>
                <TextArea rows={2} />
                <FieldError />
              </TextField>
            </Form>

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
              {t("admin.cancel")}
            </Button>
            <Button type="submit" form={FORM_ID} isPending={isPending}>
              {t("admin.save")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
