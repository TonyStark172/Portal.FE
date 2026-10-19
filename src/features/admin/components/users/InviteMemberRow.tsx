"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { Button, FieldError, Form, Input, Label, ListBox, Select, TextField, toast } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { useGetRolesQuery } from "@/shared/api/generated/portalApi";
import { ErrorCodes, toApiProblem, type ApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { splitValidationErrors } from "../../lib/validationErrors";
import { useCreateInvitationMutation, useGetInvitationAvailabilityQuery, useResendInvitationMutation } from "../../invitationsApi";
import { ConfirmDialog } from "../ConfirmDialog";

/** The pending invitation a 409 names: the back end flattens ProblemDetails extensions, but either spelling is read. */
function pendingInvitationOf(problem: ApiProblem): number | null {
  const body = problem as ApiProblem & { invitationId?: unknown; extensions?: { invitationId?: unknown } };
  const id = body.invitationId ?? body.extensions?.invitationId;
  return typeof id === "number" ? id : null;
}

/**
 * The top of the Users tab for whoever holds Users.Create: an email, a role and "Send invite", in one row that wraps on a
 * phone. Only the administrator chooses the role (from the non-administrator ones, the default first chosen); anyone
 * else sees it locked at the default and sends none, the server choosing. Without a mail server the row is a note
 * instead. An address the server refuses says why under the field; one already invited asks to send that invitation
 * again.
 */
export function InviteMemberRow() {
  const { t } = useLocale();
  const headingId = useId();
  const availability = useGetInvitationAvailabilityQuery();

  // Until the answer is in (or when it failed) nothing is shown: the form must not appear only to vanish.
  if (!availability.data) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-secondary p-4">
      <div className="flex flex-col gap-1">
        <h3 id={headingId} className="text-base font-semibold">{t("admin.invite.title")}</h3>
        <p className="text-sm text-muted">{t("admin.invite.subtitle")}</p>
      </div>
      {availability.data.canSendEmail ? <InviteForm /> : <p className="text-sm text-muted">{t("admin.invite.unavailable")}</p>}
    </section>
  );
}

function InviteForm() {
  const { t } = useLocale();
  const { isAdministrator } = useCurrentUser();
  const roles = useGetRolesQuery();
  const [createInvitation, { isLoading: isSending }] = useCreateInvitationMutation();
  const [resendInvitation, { isLoading: isResending }] = useResendInvitationMutation();

  const [email, setEmail] = useState("");
  const [pickedRoleId, setPickedRoleId] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  /** The address already has a pending invitation: which one, to send again on a yes. */
  const [pending, setPending] = useState<{ id: number; email: string } | null>(null);

  const assignableRoles = useMemo(() => (roles.data ?? []).filter((role) => !role.isAdmin), [roles.data]);
  const defaultRole = assignableRoles.find((role) => role.isDefault);
  const roleId = (isAdministrator ? pickedRoleId : null) ?? defaultRole?.id ?? null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    const address = email.trim();
    try {
      // Only the administrator may choose; for anyone else null is the default role (the server forces it anyway).
      await createInvitation({ createInvitationCommand: { email: address, roleId: isAdministrator ? roleId : null } }).unwrap();
      toast.success(t("admin.invite.sent").replace("{email}", address));
      setEmail("");
    } catch (failure) {
      const problem = toApiProblem(failure);
      const invitationId = problem.code === ErrorCodes.conflict ? pendingInvitationOf(problem) : null;
      if (invitationId !== null) {
        setPending({ id: invitationId, email: address });
        return;
      }
      const { fieldErrors: found, leftover } = splitValidationErrors(problem, ["email"]);
      setFieldErrors(found);
      // What the field cannot show (the role, or a refusal that is no validation) is said in a toast.
      if (leftover.length > 0) toast.danger(leftover.join(" "));
      else if (Object.keys(found).length === 0) toast.danger(problem.detail ?? t("common.genericError"));
    }
  }

  async function resend() {
    if (!pending) return;
    try {
      await resendInvitation({ id: pending.id }).unwrap();
      toast.success(t("admin.invite.resent").replace("{email}", pending.email));
      setEmail("");
    } catch (failure) {
      toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
    }
    setPending(null);
  }

  return (
    <>
      <Form className="flex flex-wrap items-start gap-3" validationErrors={fieldErrors} onSubmit={submit}>
        <TextField name="email" type="email" isRequired value={email} onChange={setEmail} variant="secondary" className="min-w-64 flex-1 phone:w-full phone:min-w-0">
          <Label>{t("admin.invite.email")}</Label>
          <Input autoComplete="off" placeholder={t("admin.invite.emailPlaceholder")} />
          <FieldError />
        </TextField>
        <Select
          variant="secondary"
          className="w-56 phone:w-full"
          isDisabled={!isAdministrator}
          selectedKey={roleId === null ? null : String(roleId)}
          onSelectionChange={(key) => key !== null && setPickedRoleId(Number(key))}
        >
          <Label>{t("admin.invite.role")}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {assignableRoles.map((role) => (
                <ListBox.Item id={String(role.id)} key={role.id} textValue={role.name}>
                  {role.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        {/* Level with the fields, not with their labels: the label row's height is left above it. */}
        <Button type="submit" isPending={isSending} className="mt-6 phone:mt-0 phone:w-full">
          {t("admin.invite.send")}
        </Button>
      </Form>

      {pending && (
        <ConfirmDialog
          title={t("admin.invite.resendTitle")}
          message={t("admin.invite.resendPending").replace("{email}", pending.email)}
          confirmLabel={t("admin.invite.resend")}
          isPending={isResending}
          onConfirm={() => void resend()}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}
