"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useDispatch } from "react-redux";
import { Button, Chip, FieldError, Form, Input, Label, ListBox, Modal, Select, TextField, toast } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { portalApi, useGetPermissionsQuery, useGetRolesQuery, useUpdateUserMutation, type UserAssignmentInput, type UserDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { splitValidationErrors } from "../../lib/validationErrors";
import { AssignmentFields, assignmentsOf, isAssignmentIncomplete, type AssignmentValue } from "./AssignmentFields";
import { RolePermissionsPreview } from "./RolePermissionsPreview";
import "../../api";

const FORM_ID = "edit-user-form";

/** The fields a validation error can be shown under (`assignments`: below the department and position selects). */
const FORM_FIELDS = ["fullName", "phoneNumber", "employeeCode", "joinedOn"];

type Props = {
  user: UserDto;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Edits an account: full name, phone, employee code, the day they joined, the primary department and position, and,
 * for the administrator alone, the roles (with a preview of what they allow). The person's concurrent (non-primary) assignments are not edited here: they
 * are sent back as they are. Closing the dialog discards the form (its content unmounts), so each opening starts from
 * the account as the list shows it.
 */
export function EditUserDialog({ user, isOpen, onOpenChange }: Props) {
  const { t } = useLocale();
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg" placement="center" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("admin.close")} />
          <Modal.Header>
            <Modal.Heading>{t("admin.editUserTitle").replace("{name}", user.fullName)}</Modal.Heading>
          </Modal.Header>
          <EditUserForm user={user} onClose={() => onOpenChange(false)} />
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function EditUserForm({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const { t } = useLocale();
  const dispatch = useDispatch();
  const { user: me, isAdministrator, hasPermission } = useCurrentUser();
  // The selects exist only for someone who may see both lists: only then can an error be shown under them.
  const showsAssignments = hasPermission(Permissions.Departments.View) && hasPermission(Permissions.Positions.View);
  const [updateUser, { isLoading }] = useUpdateUserMutation();
  // Only the administrator changes roles, so only they need the list of them.
  const roles = useGetRolesQuery(undefined, { skip: !isAdministrator });
  const permissions = useGetPermissionsQuery(undefined, { skip: !isAdministrator });

  const primary = user.assignments.find((assignment) => assignment.isPrimary);
  const [fullName, setFullName] = useState(user.fullName);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber ?? "");
  const [employeeCode, setEmployeeCode] = useState(user.employeeCode ?? "");
  const [joinedOn, setJoinedOn] = useState((user.joinedOn ?? "").slice(0, 10));
  const [assignment, setAssignment] = useState<AssignmentValue>({
    departmentId: primary?.departmentId ?? null,
    positionId: primary?.positionId ?? null,
  });
  // null until the administrator picks: then the roles the person has now (but the administrator's) are what is chosen.
  const [pickedRoleIds, setPickedRoleIds] = useState<number[] | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const currentRoleIds = user.roles.map((role) => role.id);
  const adminRoleIds = useMemo(() => new Set((roles.data ?? []).filter((role) => role.isAdmin).map((role) => role.id)), [roles.data]);
  const assignableRoles = useMemo(() => (roles.data ?? []).filter((role) => !role.isAdmin), [roles.data]);
  // The administrator's role is never offered; the one who holds it keeps it (shown fixed, always sent).
  const fixedRoles = (roles.data ?? []).filter((role) => role.isAdmin && currentRoleIds.includes(role.id));
  const chosenRoleIds = pickedRoleIds ?? currentRoleIds.filter((id) => !adminRoleIds.has(id));
  // Anyone else sends the roles as they are: the server refuses a change from a non-administrator.
  const roleIds = isAdministrator ? [...fixedRoles.map((role) => role.id), ...chosenRoleIds] : currentRoleIds;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setAssignmentError(null);
    if (isAssignmentIncomplete(assignment)) {
      setAssignmentError(t("admin.assignmentIncomplete"));
      return;
    }

    // The concurrent assignments go back untouched, after the primary one.
    const concurrent: UserAssignmentInput[] = user.assignments
      .filter((other) => !other.isPrimary)
      .map(({ departmentId, positionId }) => ({ departmentId, positionId: positionId ?? null, isPrimary: false }));
    // The server wants exactly one primary assignment among any, and no department twice: say so here, where it can be shown.
    if (showsAssignments && concurrent.length > 0) {
      if (assignment.departmentId === null) {
        setAssignmentError(t("admin.primaryNeededWithConcurrent"));
        return;
      }
      if (concurrent.some((other) => other.departmentId === assignment.departmentId)) {
        setAssignmentError(t("admin.primaryDuplicatesConcurrent"));
        return;
      }
    }
    try {
      await updateUser({
        id: user.id,
        updateUserCommand: {
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim() || null,
          employeeCode: employeeCode.trim() || null,
          joinedOn: joinedOn || null,
          assignments: [...assignmentsOf(assignment), ...concurrent],
          roleIds,
        },
      }).unwrap();
      // Editing oneself changes what the header shows (the name), which comes from the signed-in profile.
      if (user.id === me?.id) dispatch(portalApi.util.invalidateTags(["Auth"]));
      toast.success(t("admin.userSaved"));
      onClose();
    } catch (failure) {
      const problem = toApiProblem(failure);
      const { fieldErrors: found, leftover } = splitValidationErrors(problem, showsAssignments ? [...FORM_FIELDS, "assignments"] : FORM_FIELDS);
      const { assignments: assignmentErrors, ...formErrors } = found;
      setFieldErrors(formErrors);
      if (assignmentErrors) setAssignmentError(assignmentErrors.join(" "));
      // What no field can show (the roles, a hidden field) is said as it is; with nothing to say, the server's detail.
      if (leftover.length > 0) toast.danger(leftover.join(" "));
      else if (Object.keys(found).length === 0) toast.danger(problem.detail ?? t("common.genericError"));
    }
  }

  return (
    <>
      <Modal.Body className="flex flex-col gap-4 p-1">
        <Form id={FORM_ID} className="flex flex-col gap-4" validationErrors={fieldErrors} onSubmit={submit}>
          <TextField name="fullName" isRequired autoFocus value={fullName} onChange={setFullName} variant="secondary">
            <Label>{t("admin.fullName")}</Label>
            <Input autoComplete="off" />
            <FieldError />
          </TextField>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="phoneNumber" type="tel" value={phoneNumber} onChange={setPhoneNumber} variant="secondary">
              <Label>{t("admin.phone")}</Label>
              <Input autoComplete="off" />
              <FieldError />
            </TextField>
            <TextField name="employeeCode" value={employeeCode} onChange={setEmployeeCode} variant="secondary">
              <Label>{t("admin.employeeCode")}</Label>
              <Input autoComplete="off" />
              <FieldError />
            </TextField>
          </div>
          <TextField name="joinedOn" value={joinedOn} onChange={setJoinedOn} variant="secondary">
            <Label>{t("admin.joinedOn")}</Label>
            <Input type="date" />
            <FieldError />
          </TextField>

          <AssignmentFields
            value={assignment}
            onChange={(next) => {
              setAssignment(next);
              setAssignmentError(null);
            }}
            error={assignmentError}
            current={primary && {
              department: { id: primary.departmentId, name: primary.departmentName },
              position: primary.positionId == null ? null : { id: primary.positionId, name: primary.positionName ?? "" },
            }}
          />

          {isAdministrator && (
            <div className="flex flex-col gap-2">
              <Select
                fullWidth
                variant="secondary"
                selectionMode="multiple"
                value={chosenRoleIds.map(String)}
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
              {fixedRoles.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {fixedRoles.map((role) => (
                    <Chip key={role.id} size="sm" variant="soft" color="accent">
                      {role.name}
                    </Chip>
                  ))}
                  <span className="text-sm text-muted">{t("admin.administratorRole")}</span>
                </div>
              )}
              {roles.data && (permissions.data || permissions.isError) && (
                <RolePermissionsPreview groups={permissions.data ?? []} roles={roles.data} roleIds={roleIds} />
              )}
            </div>
          )}
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button slot="close" variant="secondary">
          {t("admin.cancel")}
        </Button>
        {/* The administrator's roles go in the request, so it waits for the list that tells which role is theirs. */}
        <Button type="submit" form={FORM_ID} isPending={isLoading} isDisabled={isAdministrator && !roles.data}>
          {t("admin.save")}
        </Button>
      </Modal.Footer>
    </>
  );
}
