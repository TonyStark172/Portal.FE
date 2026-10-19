"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Description, FieldError, Form, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { portalApi, useCreateUserMutation, useGetPermissionsQuery, useGetRolesQuery } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { splitValidationErrors } from "../../lib/validationErrors";
import { AssignmentFields, assignmentsOf, isAssignmentIncomplete, NO_ASSIGNMENT, type AssignmentValue } from "./AssignmentFields";
import { RolePermissionsPreview } from "./RolePermissionsPreview";
import "../../api";

const FORM_ID = "create-user-form";

/** The fields a validation error can be shown under (`assignments`: below the selects); any other message goes to the alert. */
const FORM_FIELDS = ["fullName", "userName", "email"];

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** The account exists: its temporary password (shown once by the caller) and the name it was created under. */
  onCreated: (temporaryPassword: string, fullName: string) => void;
};

/**
 * Creates an account: full name, a username (suggested from the name until it is typed by hand), an optional email, an
 * optional department and position, and the roles. Only the administrator chooses roles (from the non-administrator
 * ones, the default preselected) and sees what the chosen roles allow; anyone else's account gets the default role
 * from the server and sends no roles.
 * Closing the dialog discards the form (its content unmounts).
 */
export function CreateUserDialog({ isOpen, onOpenChange, onCreated }: Props) {
  const { t } = useLocale();
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg" placement="center" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("admin.close")} />
          <Modal.Header>
            <Modal.Heading>{t("admin.createAccount")}</Modal.Heading>
          </Modal.Header>
          <CreateUserForm onCreated={onCreated} onClose={() => onOpenChange(false)} />
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function CreateUserForm({ onCreated, onClose }: { onCreated: Props["onCreated"]; onClose: () => void }) {
  const { t } = useLocale();
  const { isAdministrator, hasPermission } = useCurrentUser();
  // The selects exist only for someone who may see both lists: only then can an error be shown under them.
  const showsAssignments = hasPermission(Permissions.Departments.View) && hasPermission(Permissions.Positions.View);
  const [createUser, { isLoading }] = useCreateUserMutation();
  const [suggestUserName] = portalApi.useLazySuggestUserNameQuery();
  const roles = useGetRolesQuery();
  // The permission catalogue is for the preview, which only the administrator has.
  const permissions = useGetPermissionsQuery(undefined, { skip: !isAdministrator });

  const [fullName, setFullName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [assignment, setAssignment] = useState<AssignmentValue>(NO_ASSIGNMENT);
  // null until the administrator picks: then the default role is what is chosen.
  const [pickedRoleIds, setPickedRoleIds] = useState<number[] | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  // Whether the username was typed by hand: a suggestion never replaces what a person wrote. Read when a suggestion
  // arrives (not when it was asked for), so typing while it is on its way also wins; fills by code never set it.
  const typedByHand = useRef(false);
  // Which suggestion request is the latest: an older answer arriving late is dropped.
  const suggestion = useRef(0);

  const assignableRoles = useMemo(() => (roles.data ?? []).filter((role) => !role.isAdmin), [roles.data]);
  const defaultRole = assignableRoles.find((role) => role.isDefault);
  const roleIds = pickedRoleIds ?? (defaultRole ? [defaultRole.id] : []);

  async function suggest() {
    const name = fullName.trim();
    if (!name) return;
    const request = ++suggestion.current;
    try {
      const { userName: suggested } = await suggestUserName({ fullName: name }).unwrap();
      if (request === suggestion.current && !typedByHand.current) setUserName(suggested);
    } catch {
      // A suggestion is a convenience: without one the username is simply typed.
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setError(null);
    setAssignmentError(null);
    if (isAssignmentIncomplete(assignment)) {
      setAssignmentError(t("admin.assignmentIncomplete"));
      return;
    }

    const name = fullName.trim();
    try {
      // `reset` of the hook would do nothing here (it belongs to the render that made this closure, before the request
      // existed), so the request being awaited is the one to reset.
      const pending = createUser({
        createUserCommand: {
          userName: userName.trim(),
          fullName: name,
          // The email input drops surrounding spaces itself; an empty one is "no email".
          email: email || null,
          assignments: assignmentsOf(assignment),
          // Only the administrator may give roles; the server gives everyone else the default one.
          roleIds: isAdministrator ? roleIds : [],
        },
      });
      const created = await pending.unwrap();
      // The password must not stay in RTK Query's mutation state once it is handed over.
      pending.reset();
      onCreated(created.temporaryPassword, name);
      onClose();
    } catch (failure) {
      const problem = toApiProblem(failure);
      const { fieldErrors: found, leftover } = splitValidationErrors(problem, showsAssignments ? [...FORM_FIELDS, "assignments"] : FORM_FIELDS);
      const { assignments: assignmentErrors, ...formErrors } = found;
      setFieldErrors(formErrors);
      if (assignmentErrors) setAssignmentError(assignmentErrors.join(" "));
      // What no field can show (the roles, a hidden field) is said as it is; with nothing to say, the server's detail.
      if (leftover.length > 0) setError(leftover.join(" "));
      else if (Object.keys(found).length === 0) setError(problem.detail ?? t("common.genericError"));
    }
  }

  return (
    <>
      <Modal.Body className="flex flex-col gap-4 p-1">
        <Form id={FORM_ID} className="flex flex-col gap-4" validationErrors={fieldErrors} onSubmit={submit}>
          <TextField name="fullName" isRequired autoFocus value={fullName} onChange={setFullName} onBlur={() => void suggest()} variant="secondary">
            <Label>{t("admin.fullName")}</Label>
            <Input autoComplete="off" />
            <FieldError />
          </TextField>
          <TextField
            name="userName"
            isRequired
            value={userName}
            onChange={(value) => {
              typedByHand.current = true;
              setUserName(value);
            }}
            variant="secondary"
          >
            <Label>{t("admin.userName")}</Label>
            <Input autoComplete="off" />
            <FieldError />
          </TextField>
          <TextField name="email" type="email" value={email} onChange={setEmail} variant="secondary">
            <Label>{t("admin.email")}</Label>
            <Input autoComplete="off" />
            <Description>{t("admin.emailHint")}</Description>
            <FieldError />
          </TextField>

          <AssignmentFields
            value={assignment}
            onChange={(next) => {
              setAssignment(next);
              setAssignmentError(null);
            }}
            error={assignmentError}
          />

          {isAdministrator ? (
            <Select
              fullWidth
              variant="secondary"
              selectionMode="multiple"
              value={roleIds.map(String)}
              onChange={(keys) => setPickedRoleIds(keys.map(Number))}
            >
              <Label>{t("admin.rolesLabel")}</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox selectionMode="multiple">
                  {assignableRoles.map((role) => (
                    <ListBox.Item id={String(role.id)} key={role.id} textValue={role.name}>
                      {role.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          ) : (
            defaultRole && <p className="text-sm text-muted">{t("admin.defaultRoleGiven").replace("{name}", defaultRole.name)}</p>
          )}
          {isAdministrator && roles.data && (permissions.data || permissions.isError) && (
            <RolePermissionsPreview groups={permissions.data ?? []} roles={roles.data} roleIds={roleIds} />
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
        <Button slot="close" variant="secondary">
          {t("admin.cancel")}
        </Button>
        <Button type="submit" form={FORM_ID} isPending={isLoading}>
          {t("admin.createAccount")}
        </Button>
      </Modal.Footer>
    </>
  );
}
