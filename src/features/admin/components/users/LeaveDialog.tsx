"use client";

import { useState, type FormEvent } from "react";
import { Button, FieldError, Form, Input, Label, Modal, TextField, toast } from "@heroui/react";
import { useDeactivateUserMutation, useReactivateUserMutation, type UserDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { todayAsDateInput } from "../../lib/dates";
import { splitValidationErrors } from "../../lib/validationErrors";
import "../../api";

const FORM_ID = "leave-user-form";

type Props = {
  user: UserDto;
  /** "leave": the person's last working day; "takeBack": the day they come back. */
  mode: "leave" | "takeBack";
  onClose: () => void;
};

/**
 * Lets someone leave (their last working day) or takes them back (the day they rejoin), the day starting as today in the
 * user's own time zone. The parent mounts it only while it is open, so each opening starts from today. A refusal is
 * shown in a toast and the dialog stays, so another day can be tried; a refusal of the day itself shows under the field.
 */
export function LeaveDialog({ user, mode, onClose }: Props) {
  const { t } = useLocale();
  const [deactivateUser, { isLoading: isLeaving }] = useDeactivateUserMutation();
  const [reactivateUser, { isLoading: isReturning }] = useReactivateUserMutation();
  const [day, setDay] = useState(todayAsDateInput);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const leaving = mode === "leave";
  // The API's name for the day, which a validation error is reported under.
  const field = leaving ? "leftOn" : "rejoinedOn";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    try {
      if (leaving) await deactivateUser({ id: user.id, deactivateUserCommand: { leftOn: day } }).unwrap();
      else await reactivateUser({ id: user.id, reactivateUserCommand: { rejoinedOn: day } }).unwrap();
      toast.success(t(leaving ? "admin.userLeft" : "admin.userTakenBack"));
      onClose();
    } catch (failure) {
      const problem = toApiProblem(failure);
      const { fieldErrors: found, leftover } = splitValidationErrors(problem, [field]);
      setFieldErrors(found);
      // What the field cannot show is said as it is; with nothing to say, the server's detail.
      if (leftover.length > 0) toast.danger(leftover.join(" "));
      else if (Object.keys(found).length === 0) toast.danger(problem.detail ?? t("common.genericError"));
    }
  }

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container size="sm" placement="center">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("admin.close")} />
          <Modal.Header>
            <Modal.Heading>{t(leaving ? "admin.letLeaveTitle" : "admin.takeBackTitle").replace("{name}", user.fullName)}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4 p-1">
            <Form id={FORM_ID} validationErrors={fieldErrors} onSubmit={submit}>
              <TextField name={field} isRequired autoFocus value={day} onChange={setDay} variant="secondary">
                <Label>{t(leaving ? "admin.lastDay" : "admin.rejoinDay")}</Label>
                <Input type="date" />
                <FieldError />
              </TextField>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              {t("admin.cancel")}
            </Button>
            <Button type="submit" form={FORM_ID} isPending={isLeaving || isReturning}>
              {t(leaving ? "admin.letLeave" : "admin.takeBack")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
