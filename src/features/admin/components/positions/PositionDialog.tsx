"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, FieldError, Form, Input, Label, Modal, TextField, toast } from "@heroui/react";
import { useCreatePositionMutation, useUpdatePositionMutation, type PositionDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { NumberStepper } from "@/shared/ui/NumberStepper";
import { suggestCode } from "../../lib/suggestCode";
import { splitValidationErrors } from "../../lib/validationErrors";
import "../../api";

const FORM_ID = "position-form";

/** The fields a validation error can be shown under (the form's own camelCase spelling). */
const FIELDS = ["code", "name", "level"];

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;

const clampLevel = (level: number) => Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));

type Props = {
  /** The position to edit; without it the dialog adds a new one. */
  position?: PositionDto;
  /** The level a new position starts at (one below the lowest listed); 1 when not given. */
  suggestedLevel?: number;
  onClose: () => void;
};

/**
 * Adds a position, or edits one: a name, a code (suggested from the name until it is typed by hand; an existing position
 * keeps its own), and a level (1 is the highest). The name field shows the position's own
 * (untranslated) name and sends it as both `name` and `originalName`; the translated one is never sent back. The parent
 * mounts it with a fresh `key` each time it opens, so its state always starts from `position`.
 * The server's refusals of a field (a code already taken…) show under that field; any other refusal shows in an alert.
 */
export function PositionDialog({ position, suggestedLevel, onClose }: Props) {
  const { t } = useLocale();
  const [createPosition, { isLoading: isCreating }] = useCreatePositionMutation();
  const [updatePosition, { isLoading: isUpdating }] = useUpdatePositionMutation();
  const [name, setName] = useState(position?.originalName ?? "");
  // null until typed by hand: then the code is the suggestion for the name (an existing position keeps its own).
  const [typedCode, setTypedCode] = useState<string | null>(position ? position.code : null);
  // NaN while the field is empty; the − and + buttons and the field itself keep it within 1–5.
  const [level, setLevel] = useState<number>(position?.level ?? clampLevel(suggestedLevel ?? MIN_LEVEL));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  const code = typedCode ?? suggestCode(name);

  /** What is missing or out of range, said under the fields; empty when the form is fine. */
  function check(): Record<string, string[]> {
    const problems: Record<string, string[]> = {};
    if (!name.trim()) problems.name = [t("positions.nameRequired")];
    if (!code.trim()) problems.code = [t("positions.codeRequired")];
    if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
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

    // No description is asked any more: a new position has none, an existing one keeps the one it had.
    const common = { code: code.trim(), name: name.trim(), level, description: position?.description ?? null };
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
            {/* The errors are passed field by field (isInvalid), not as validationErrors, so the same message shows again on a second try; "aria" keeps an invalid field from blocking the next submit natively (isRequired then only marks the field; check() says what is missing). */}
            <Form id={FORM_ID} className="flex flex-col gap-4" validationBehavior="aria" onSubmit={submit}>
              <TextField name="name" isRequired autoFocus value={name} onChange={edited(typedCode === null ? ["name", "code"] : ["name"], setName)} isInvalid={"name" in fieldErrors} variant="secondary">
                <Label>{t("positions.name")}</Label>
                <Input autoComplete="off" />
                <FieldError>{fieldErrors.name?.join(" ")}</FieldError>
              </TextField>
              <TextField name="code" isRequired value={code} onChange={edited(["code"], setTypedCode)} isInvalid={"code" in fieldErrors} variant="secondary">
                <Label>{t("positions.code")}</Label>
                <Input autoComplete="off" />
                <FieldError>{fieldErrors.code?.join(" ")}</FieldError>
              </TextField>
              {/* − and + move one level (the arrow keys too); it stays within 1–5. */}
              <NumberStepper
                name="level"
                isRequired
                value={level}
                onChange={edited(["level"], setLevel)}
                minValue={MIN_LEVEL}
                maxValue={MAX_LEVEL}
                isInvalid={"level" in fieldErrors}
                formatOptions={{ maximumFractionDigits: 0, useGrouping: false }}
                label={t("positions.level")}
                description={t("positions.levelHint")}
                errorMessage={fieldErrors.level?.join(" ")}
                decrementLabel={t("positions.levelDecrease")}
                incrementLabel={t("positions.levelIncrease")}
              />
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
