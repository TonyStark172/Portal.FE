"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, Description, FieldError, Form, Input, Label, Modal, Switch, TextArea, TextField, toast } from "@heroui/react";
import { useCreatePositionMutation, useUpdatePositionMutation, type PositionDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { suggestCode } from "../../lib/codes";
import { splitValidationErrors } from "../../lib/validationErrors";

const FORM_ID = "position-form";
/** The fields a refusal can be shown under; the API reports the edited name as `originalName`. */
const shownFields = ["name", "originalName", "code", "level", "description"];

type Props = {
  /** The position to change; absent for a new one. */
  position?: PositionDto;
  onClose: () => void;
};

/**
 * Creates or changes a position: its title, code (suggested from the title until the user types one), level (1 is
 * the highest rank) and description, and on an existing one whether it is still in use. The title edited is the
 * original one, never the translation the list may show. The parent mounts it afresh each time it opens.
 */
export function PositionDialog({ position, onClose }: Props) {
  const { t } = useLocale();
  const [createPosition, { isLoading: isCreating }] = useCreatePositionMutation();
  const [updatePosition, { isLoading: isUpdating }] = useUpdatePositionMutation();
  const [name, setName] = useState(position?.originalName ?? "");
  const [code, setCode] = useState(position?.code ?? "");
  // A new position's code follows its title until the user types a code of their own.
  const [codeTouched, setCodeTouched] = useState(Boolean(position));
  const [level, setLevel] = useState(position ? String(position.level) : "");
  const [description, setDescription] = useState(position?.description ?? "");
  const [isActive, setIsActive] = useState(position?.isActive ?? true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setError(null);
    const fields = { code: code.trim(), name: name.trim(), level: Number(level), description: description.trim() || null };
    try {
      if (position) {
        await updatePosition({ id: position.id, updatePositionCommand: { ...fields, originalName: fields.name, isActive } }).unwrap();
      } else {
        await createPosition({ createPositionCommand: fields }).unwrap();
      }
      toast.success(t("admin.positionSaved"));
      onClose();
    } catch (failure) {
      const problem = toApiProblem(failure);
      const { fieldErrors: found, leftover } = splitValidationErrors(problem, shownFields);
      const { originalName, ...rest } = found;
      setFieldErrors(originalName ? { ...rest, name: originalName } : rest);
      if (leftover.length > 0) setError(leftover.join(" "));
      else if (Object.keys(found).length === 0) setError(problem.detail ?? t("common.genericError"));
    }
  }

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container size="md" placement="center" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("admin.close")} />
          <Modal.Header className="pe-8">
            <Modal.Heading>{position ? t("admin.editPosition") : t("admin.createPosition")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4 p-1">
            <Form id={FORM_ID} className="flex flex-col gap-4" validationErrors={fieldErrors} onSubmit={submit}>
              <TextField name="name" isRequired autoFocus value={name} variant="secondary"
                onChange={(value) => { setName(value); if (!codeTouched) setCode(suggestCode(value)); }}>
                <Label>{t("admin.positionName")}</Label>
                <Input />
                <FieldError />
              </TextField>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField name="code" isRequired value={code} variant="secondary"
                  onChange={(value) => { setCode(value); setCodeTouched(true); }}>
                  <Label>{t("admin.code")}</Label>
                  <Input />
                  <FieldError />
                </TextField>
                <TextField name="level" isRequired value={level} onChange={setLevel} variant="secondary">
                  <Label>{t("admin.level")}</Label>
                  <Input type="number" min={1} max={100} step={1} />
                  <Description>{t("admin.levelHint")}</Description>
                  <FieldError />
                </TextField>
              </div>
              <TextField name="description" value={description} onChange={setDescription} variant="secondary">
                <Label>{t("admin.description")}</Label>
                <TextArea rows={2} />
                <FieldError />
              </TextField>
              {position && (
                <Switch size="sm" isSelected={isActive} onChange={setIsActive}>
                  <Switch.Content>
                    <Switch.Control><Switch.Thumb /></Switch.Control>
                    <Label>{t("admin.positionInUse")}</Label>
                  </Switch.Content>
                </Switch>
              )}
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
            <Button slot="close" variant="secondary">{t("admin.cancel")}</Button>
            <Button type="submit" form={FORM_ID} isPending={isCreating || isUpdating}>{t("admin.save")}</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
