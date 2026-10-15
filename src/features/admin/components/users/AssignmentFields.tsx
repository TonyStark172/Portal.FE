"use client";

import { Label, ListBox, Select } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import {
  useGetDepartmentsQuery,
  useGetPositionsQuery,
  type UserAssignmentInput,
} from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";

/** A person's primary department and position; each is null while none is chosen. */
export type AssignmentValue = { departmentId: number | null; positionId: number | null };

export const NO_ASSIGNMENT: AssignmentValue = { departmentId: null, positionId: null };

/** Key of the "not assigned" option (the option ids of a Select are strings, and a real id is never "none"). */
const NONE = "none";

/** Exactly one of the two is chosen: a department without a position (or the other way round) is not an assignment. */
export const isAssignmentIncomplete = ({ departmentId, positionId }: AssignmentValue) => (departmentId === null) !== (positionId === null);

/** What the API takes for `value`: the one primary assignment, or none while the pair is not complete. */
export function assignmentsOf({ departmentId, positionId }: AssignmentValue): UserAssignmentInput[] {
  return departmentId === null || positionId === null ? [] : [{ departmentId, positionId, isPrimary: true }];
}

/** A department or position by id and name. */
type Named = { id: number; name: string };

type Props = {
  value: AssignmentValue;
  onChange: (value: AssignmentValue) => void;
  isDisabled?: boolean;
  /** Why the pair cannot be saved, shown below the two fields. */
  error?: string | null;
  /**
   * The department and position the person has now, when editing. Only active ones are offered, but the current ones
   * may have been deactivated since: they are added to the options so they stay shown (a Select shows nothing for a
   * key that is not among its options) and can be kept or chosen again.
   */
  current?: { department?: Named | null; position?: Named | null };
};

/** The options of a list, with `current` among them when it is not already (an inactive one the list leaves out). */
function withCurrent(listed: Named[], current: Named | null | undefined): Named[] {
  return current && !listed.some((item) => item.id === current.id) ? [...listed, current] : listed;
}

/**
 * The department and position of one primary assignment, both optional ("not assigned" is a choice). The lists have
 * permissions of their own (Departments.View, Positions.View) which the person editing an account may lack: then
 * nothing is shown, nothing is requested, and `value` stays as it was given.
 */
export function AssignmentFields({ value, onChange, isDisabled, error, current }: Props) {
  const { t } = useLocale();
  const { hasPermission } = useCurrentUser();
  const canChoose = hasPermission(Permissions.Departments.View) && hasPermission(Permissions.Positions.View);
  const departments = useGetDepartmentsQuery({ isActive: true }, { skip: !canChoose });
  const positions = useGetPositionsQuery({ isActive: true }, { skip: !canChoose });

  if (!canChoose) return null;

  const key = (id: number | null) => (id === null ? NONE : String(id));
  const idOf = (selected: string | number | null) => (selected === null || selected === NONE ? null : Number(selected));

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <AssignmentSelect
          label={t("admin.department")}
          noneLabel={t("admin.noAssignment")}
          isDisabled={isDisabled}
          selectedKey={key(value.departmentId)}
          onSelectionChange={(selected) => onChange({ ...value, departmentId: idOf(selected) })}
          options={withCurrent(departments.data ?? [], current?.department).map((department) => ({ id: String(department.id), name: department.name }))}
        />
        <AssignmentSelect
          label={t("admin.position")}
          noneLabel={t("admin.noAssignment")}
          isDisabled={isDisabled}
          selectedKey={key(value.positionId)}
          onSelectionChange={(selected) => onChange({ ...value, positionId: idOf(selected) })}
          options={withCurrent(positions.data ?? [], current?.position).map((position) => ({ id: String(position.id), name: position.name }))}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

type SelectProps = {
  label: string;
  noneLabel: string;
  isDisabled?: boolean;
  selectedKey: string;
  onSelectionChange: (key: string | number | null) => void;
  options: { id: string; name: string }[];
};

function AssignmentSelect({ label, noneLabel, isDisabled, selectedKey, onSelectionChange, options }: SelectProps) {
  return (
    <Select fullWidth variant="secondary" isDisabled={isDisabled} selectedKey={selectedKey} onSelectionChange={onSelectionChange}>
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {[{ id: NONE, name: noneLabel }, ...options].map((option) => (
            <ListBox.Item id={option.id} key={option.id} textValue={option.name}>
              {option.name}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
