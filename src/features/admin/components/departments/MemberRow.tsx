"use client";

import { useEffect, useRef, useState, type Key } from "react";
import { Ellipsis } from "@gravity-ui/icons";
import { Button, Chip, Dropdown, Label, ListBox, Modal, Select, toast } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import {
  useGetPositionsQuery,
  useRemoveDepartmentMemberMutation,
  useSetPrimaryDepartmentMutation,
  useUpdateDepartmentMemberMutation,
  type DepartmentChartNode,
  type DepartmentMemberDto,
  type DepartmentRole,
} from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { ConfirmDialog } from "../ConfirmDialog";
import "../../api";

type RowAction = "Head" | "Deputy" | "Member" | "position" | "primary" | "remove";

/** The item that makes a person `role`, by the role. */
const ROLE_ITEMS: { role: DepartmentRole; label: string }[] = [
  { role: "Head", label: "departments.row.makeHead" },
  { role: "Deputy", label: "departments.row.makeDeputy" },
  { role: "Member", label: "departments.row.makeMember" },
];

type Props = {
  member: DepartmentMemberDto;
  department: DepartmentChartNode;
  /** The viewer may change members (Departments.Update): without it the row has no menu. */
  canEdit: boolean;
  /** The chart's search was for this person: the row stands out (`aria-current`) and is scrolled into view. */
  isHighlighted?: boolean;
};

/**
 * One person of a department: avatar, name, position (or "Chưa có chức danh") and a "Phòng chính" chip when this is
 * their primary department. With `canEdit` the row's menu changes their role here (the current one is not offered; the
 * position is kept), their position, their primary department (not offered where it already is) or removes them
 * (after a confirmation). The writes refresh the lists through the mutations' tags; success is a toast, and so is a
 * refusal (there is no form to show it in), except in the position dialog, which stays open and says why.
 */
export function MemberRow({ member, department, canEdit, isHighlighted }: Props) {
  const { t } = useLocale();
  const { hasPermission } = useCurrentUser();
  const [updateMember] = useUpdateDepartmentMemberMutation();
  const [removeMember, { isLoading: isRemoving }] = useRemoveDepartmentMemberMutation();
  const [setPrimary] = useSetPrimaryDepartmentMutation();
  const [open, setOpen] = useState<"position" | "remove" | null>(null);
  const row = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (isHighlighted) row.current?.scrollIntoView({ block: "nearest" });
  }, [isHighlighted]);

  // Choosing a position needs the positions list, which has a right of its own.
  const canChoosePosition = hasPermission(Permissions.Positions.View);
  const items: { id: RowAction; label: string; danger?: boolean }[] = [
    ...ROLE_ITEMS.filter((item) => item.role !== member.role).map((item) => ({ id: item.role, label: t(item.label) })),
    ...(canChoosePosition ? [{ id: "position" as const, label: t("departments.row.changePosition") }] : []),
    ...(member.isPrimary ? [] : [{ id: "primary" as const, label: t("departments.row.makePrimary") }]),
    { id: "remove", label: t("departments.row.remove"), danger: true },
  ];

  async function run(request: { unwrap: () => Promise<unknown> }, done: string) {
    try {
      await request.unwrap();
      toast.success(t(done));
    } catch (failure) {
      toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
    }
  }

  function act(action: RowAction) {
    if (action === "position" || action === "remove") {
      setOpen(action);
    } else if (action === "primary") {
      void run(setPrimary({ id: department.id, userId: member.userId }), "departments.toast.primary");
    } else {
      // The position is kept: the command replaces both fields.
      void run(
        updateMember({ id: department.id, userId: member.userId, updateDepartmentMemberCommand: { role: action, positionId: member.positionId ?? null } }),
        "departments.toast.updated",
      );
    }
  }

  async function confirmRemove() {
    await run(removeMember({ id: department.id, userId: member.userId }), "departments.toast.removed");
    setOpen(null);
  }

  return (
    <li
      ref={row}
      aria-current={isHighlighted ? "true" : undefined}
      className={`flex items-center gap-3 py-2 ${isHighlighted ? "-mx-2 rounded-lg bg-accent/10 px-2 ring-1 ring-accent" : ""}`}
    >
      <UserAvatar fullName={member.fullName} avatarUrl={member.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{member.fullName}</p>
        <p className="truncate text-xs text-muted">{member.positionName ?? t("departments.noPosition")}</p>
      </div>
      {member.isPrimary && (
        <Chip size="sm" variant="soft" color="success" className="shrink-0">
          {t("departments.primary")}
        </Chip>
      )}
      {canEdit && (
        <Dropdown>
          <Dropdown.Trigger
            aria-label={t("departments.menu").replace("{name}", member.fullName)}
            className="shrink-0 rounded-full p-1 text-muted outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Ellipsis className="size-4" />
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu aria-label={t("departments.menu").replace("{name}", member.fullName)} onAction={(key: Key) => act(key as RowAction)}>
              {items.map((item) => (
                <Dropdown.Item key={item.id} id={item.id} textValue={item.label} variant={item.danger ? "danger" : undefined}>
                  <Label>{item.label}</Label>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      )}

      {open === "position" && <PositionDialog member={member} department={department} onClose={() => setOpen(null)} />}
      {open === "remove" && (
        <ConfirmDialog
          title={t("departments.row.remove")}
          message={t("departments.row.removeConfirm").replace("{name}", member.fullName).replace("{department}", department.name)}
          confirmLabel={t("departments.row.remove")}
          danger
          isPending={isRemoving}
          onConfirm={() => void confirmRemove()}
          onClose={() => setOpen(null)}
        />
      )}
    </li>
  );
}

/** Key of "no position" in the select (a real id is never "none"). */
const NONE = "none";

/**
 * Changes one person's position in a department: a select of the active positions plus "Không có chức danh" (which
 * sends null). The person's current position is listed even if it was deactivated since, so it stays shown. Their
 * role is sent unchanged. A refusal stays in the dialog.
 */
function PositionDialog({ member, department, onClose }: { member: DepartmentMemberDto; department: DepartmentChartNode; onClose: () => void }) {
  const { t } = useLocale();
  const positions = useGetPositionsQuery({ isActive: true });
  const [updateMember, { isLoading }] = useUpdateDepartmentMemberMutation();
  const [positionKey, setPositionKey] = useState(member.positionId == null ? NONE : String(member.positionId));
  const [error, setError] = useState<string | null>(null);

  const listed = positions.data ?? [];
  const options = [
    { id: NONE, name: t("departments.position.none") },
    ...listed.map((position) => ({ id: String(position.id), name: position.name })),
    ...(member.positionId != null && !listed.some((position) => position.id === member.positionId)
      ? [{ id: String(member.positionId), name: member.positionName ?? `#${member.positionId}` }]
      : []),
  ];

  async function save() {
    setError(null);
    try {
      await updateMember({
        id: department.id,
        userId: member.userId,
        updateDepartmentMemberCommand: { role: member.role, positionId: positionKey === NONE ? null : Number(positionKey) },
      }).unwrap();
      toast.success(t("departments.toast.updated"));
      onClose();
    } catch (failure) {
      setError(toApiProblem(failure).detail ?? t("common.genericError"));
    }
  }

  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container size="sm" placement="center">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("admin.close")} />
          <Modal.Header>
            <Modal.Heading>{t("departments.position.title").replace("{name}", member.fullName)}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3 p-1">
            <Select fullWidth variant="secondary" selectedKey={positionKey} onSelectionChange={(key) => setPositionKey(String(key))}>
              <Label>{t("departments.position.label")}</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {options.map((option) => (
                    <ListBox.Item id={option.id} key={option.id} textValue={option.name}>
                      {option.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              {t("admin.cancel")}
            </Button>
            <Button isPending={isLoading} onPress={() => void save()}>
              {t("departments.position.save")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
