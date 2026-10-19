"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, Description, FieldError, Form, Input, Label, Modal, TextArea, TextField, toast } from "@heroui/react";
import { useCreatePositionMutation, useUpdatePositionMutation, type PositionDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { suggestCode } from "../../lib/suggestCode";
import { splitValidationErrors } from "../../lib/validationErrors";
import "../../api";

const FORM_ID = "position-form";

/** The fields a validation error can be shown under (the form's own camelCase spelling). */
const FIELDS = ["code", "name", "level", "description"];

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 100;
const MAX_DESCRIPTION = 500;

type Props = {
  /** The position to edit; without it the dialog adds a new one. */
  position?: PositionDto;
  onClose: () => void;
};

/**
 * Adds a position, or edits one: a name, a code (suggested from the name until it is typed by hand; an existing position
 * keeps its own), a level (1 is the highest) and an optional description. The name field shows the position's own
 * (untranslated) name and sends it as both `name` and `originalName`; the translated one is never sent back. The parent
 * mounts it with a fresh `key` each time it opens, so its state always starts from `position`.
 * The server's refusals of a field (a code already taken…) show under that field; any other refusal shows in an alert.
 */
export function PositionDialog({ position, onClose }: Props) {
  const { t } = useLocale();
  const [createPosition, { isLoading: isCreating }] = useCreatePositionMutation();
  const [updatePosition, { isLoading: isUpdating }] = useUpdatePositionMutation();
  const [name, setName] = useState(position?.originalName ?? "");
  // null until typed by hand: then the code is the suggestion for the name (an existing position keeps its own).
  const [typedCode, setTypedCode] = useState<string | null>(position ? position.code : null);
  const [level, setLevel] = useState(position ? String(position.level) : "");
  const [description, setDescription] = useState(position?.description ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  const code = typedCode ?? suggestCode(name);

  /** What is missing or out of range, said under the fields; empty when the form is fine. */
  function check(): Record<string, string[]> {
    const problems: Record<string, string[]> = {};
    if (!name.trim()) problems.name = [t("positions.nameRequired")];
    if (!code.trim()) problems.code = [t("positions.codeRequired")];
    const number = Number(level);
    if (level.trim() === "" || !Number.isInteger(number) || number < MIN_LEVEL || number > MAX_LEVEL) {
      problems.level = [t("positions.levelInvalid")];
    }
    return problems;
  }

  /** A change of a field takes the errors of `fields` away: they were about what was there before. */
  const edited = <T,>(fields: string[], set: (value: T) => void) => (value: T) => {
    set(value);
    setFieldErrors((current) => {
      const rest = { ...current };
      for (const field of fields) delete rest[field];
      return rest;
    });
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const problems = check();
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) return;

    const common = { code: code.trim(), name: name.trim(), level: Number(level), description: description.trim() || null };
    try {
      if (position) {
        await updatePosition({
          id: position.id,
          updatePositionCommand: { ...common, originalName: name.trim(), isActive: position.isActive },
        }).unwrap();
      } else {
        await createPosition({ createPositionCommand: common }).unwrap();
      }
      toast.success(t(position ? "positions.saved" : "positions.created"));
      onClose();
    } catch (failure) {
      const problem = toApiProblem(failure);
      const { fieldErrors: found, leftover } = splitValidationErrors(problem, FIELDS);
      setFieldErrors(found);
      // What no field can show is said as it is; with nothing to say, the server's detail.
      if (leftover.length > 0) setError(leftover.join(" "));
      else if (Object.keys(found).length === 0) setError(problem.detail ?? t("common.genericError"));
    }
  }

  const isPending = isCreating || isUpdating;
  // Once the request is on its way it cannot be called back, so "no" (Huỷ, Escape, a click outside) is no longer offered.
  const dismiss = (open: boolean) => !open && !isPending && onClose();

  return (
    <Modal.Backdrop isOpen isDismissable={!isPending} isKeyboardDismissDisabled={isPending} onOpenChange={dismiss}>
      <Modal.Container size="md" placement="center" scroll="inside">
        <Modal.Dialog>
          {!isPending && <Modal.CloseTrigger aria-label={t("admin.close")} />}
          <Modal.Header>
            <Modal.Heading>{t(position ? "positions.editTitle" : "positions.createTitle")}</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-4 p-1">
            {/* The errors are passed field by field (isInvalid), not as validationErrors, so the same message shows again on a second try; "aria" keeps an invalid field from blocking the next submit natively. */}
            <Form id={FORM_ID} className="flex flex-col gap-4" validationBehavior="aria" onSubmit={submit}>
              <TextField name="name" autoFocus value={name} onChange={edited(typedCode === null ? ["name", "code"] : ["name"], setName)} isInvalid={"name" in fieldErrors} variant="secondary">
                <Label>{t("positions.name")}</Label>
                <Input autoComplete="off" />
                <FieldError>{fieldErrors.name?.join(" ")}</FieldError>
              </TextField>
              <TextField name="code" value={code} onChange={edited(["code"], setTypedCode)} isInvalid={"code" in fieldErrors} variant="secondary">
                <Label>{t("positions.code")}</Label>
                <Input autoComplete="off" />
                <FieldError>{fieldErrors.code?.join(" ")}</FieldError>
              </TextField>
              <TextField name="level" value={level} onChange={edited(["level"], setLevel)} isInvalid={"level" in fieldErrors} variant="secondary">
                <Label>{t("positions.level")}</Label>
                {/* No min, max or step: the browser would refuse the form in its own words before level is checked below. */}
                <Input type="number" inputMode="numeric" />
                <Description>{t("positions.levelHint")}</Description>
                <FieldError>{fieldErrors.level?.join(" ")}</FieldError>
              </TextField>
              <TextField name="description" value={description} onChange={edited(["description"], setDescription)} isInvalid={"description" in fieldErrors} maxLength={MAX_DESCRIPTION} variant="secondary">
                <Label>{t("positions.description")}</Label>
                <TextArea rows={3} />
                <FieldError>{fieldErrors.description?.join(" ")}</FieldError>
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
            <Button slot="close" variant="secondary" isDisabled={isPending}>
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
