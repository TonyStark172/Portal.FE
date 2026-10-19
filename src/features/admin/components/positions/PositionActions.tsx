"use client";

import { useState, type Key, type ReactNode } from "react";
import { ArrowRotateLeft, Ellipsis, Pencil, PersonXmark, TrashBin } from "@gravity-ui/icons";
import { Dropdown, Label, toast } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { useDeletePositionMutation, useUpdatePositionMutation, type PositionDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { ConfirmDialog } from "../ConfirmDialog";
import { PositionDialog } from "./PositionDialog";
import "../../api";

type Action = "edit" | "toggle" | "delete";

/**
 * The menu of one row of the positions table, by what the viewer may do: edit (Positions.Update), discontinue or
 * reactivate (Positions.Update, by whether it is in use) and delete (Positions.Delete). With nothing to offer there is no
 * menu button at all. Discontinuing and reactivating send the row's own fields with the flipped `isActive`, at once.
 * Deleting asks first. A position people hold cannot be deleted (the server answers 409 and says so): the dialog then
 * shows that reason and, to whoever may update and while the position is in use, offers to discontinue it instead.
 * Any other refusal closes the confirmation and a toast says why.
 */
export function PositionActions({ position }: { position: PositionDto }) {
  const { t } = useLocale();
  const { hasPermission } = useCurrentUser();
  const [open, setOpen] = useState<Action | null>(null);
  // The server's reason for refusing to delete, while the dialog shows it.
  const [refusal, setRefusal] = useState<string | null>(null);
  const [updatePosition, { isLoading: isUpdating }] = useUpdatePositionMutation();
  const [deletePosition, { isLoading: isDeleting }] = useDeletePositionMutation();

  const canUpdate = hasPermission(Permissions.Positions.Update);
  const items: { id: Action; label: string; icon: ReactNode; danger?: boolean }[] = [];
  if (canUpdate) {
    items.push({ id: "edit", label: t("admin.edit"), icon: <Pencil className="size-4 shrink-0 text-muted" /> });
    items.push(position.isActive
      ? { id: "toggle", label: t("positions.deactivate"), icon: <PersonXmark className="size-4 shrink-0 text-muted" /> }
      : { id: "toggle", label: t("positions.reactivate"), icon: <ArrowRotateLeft className="size-4 shrink-0 text-muted" /> });
  }
  if (hasPermission(Permissions.Positions.Delete)) {
    items.push({ id: "delete", label: t("admin.delete"), icon: <TrashBin className="size-4 shrink-0 text-danger" />, danger: true });
  }
  if (items.length === 0) return null;

  const close = () => {
    setOpen(null);
    setRefusal(null);
  };

  /** Discontinues or reactivates: the row's fields as they are, `isActive` flipped. Returns whether it went through. */
  async function setActive(isActive: boolean) {
    try {
      await updatePosition({
        id: position.id,
        updatePositionCommand: {
          code: position.code,
          name: position.originalName,
          originalName: position.originalName,
          level: position.level,
          description: position.description ?? null,
          isActive,
        },
      }).unwrap();
      toast.success(t(isActive ? "positions.reactivated" : "positions.deactivated"));
      return true;
    } catch (failure) {
      toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
      return false;
    }
  }

  async function toggle() {
    await setActive(!position.isActive);
  }

  async function discontinueInstead() {
    await setActive(false);
    close();
  }

  async function remove() {
    try {
      await deletePosition({ id: position.id }).unwrap();
      close();
      toast.success(t("positions.deleted"));
    } catch (failure) {
      const problem = toApiProblem(failure);
      const detail = problem.detail ?? t("common.genericError");
      // Held by people: say so in the dialog, and offer the way out when it is the viewer's to take.
      if (problem.status === 409 && canUpdate && position.isActive) setRefusal(detail);
      else {
        close();
        toast.danger(detail);
      }
    }
  }

  return (
    <>
      <Dropdown>
        <Dropdown.Trigger
          aria-label={`${t("admin.rowActions")} · ${position.name}`}
          className="tap-target rounded-full p-1.5 text-muted outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Ellipsis className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu
            aria-label={t("admin.rowActions")}
            onAction={(key: Key) => {
              if (key === "toggle") void toggle();
              else setOpen(key as Action);
            }}
          >
            {items.map((item) => (
              <Dropdown.Item key={item.id} id={item.id} textValue={item.label} variant={item.danger ? "danger" : undefined}>
                {item.icon}
                <Label>{item.label}</Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      {open === "edit" && <PositionDialog position={position} onClose={close} />}
      {open === "delete" && (
        // The same dialog turns from the question into the reason (and the way out), so it does not flash away and back.
        <ConfirmDialog
          title={t(refusal === null ? "positions.deleteTitle" : "positions.cannotDeleteTitle").replace("{name}", position.name)}
          message={refusal ?? t("positions.deleteConfirm")}
          confirmLabel={refusal === null ? t("admin.delete") : t("positions.deactivate")}
          danger={refusal === null}
          isPending={refusal === null ? isDeleting : isUpdating}
          onConfirm={() => void (refusal === null ? remove() : discontinueInstead())}
          onClose={close}
        />
      )}
    </>
  );
}
