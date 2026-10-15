"use client";

import { useState, type Key, type ReactNode } from "react";
import { ArrowRotateLeft, Ellipsis, Key as KeyIcon, Pencil, PersonXmark, TrashBin } from "@gravity-ui/icons";
import { AlertDialog, Button, Dropdown, Label, toast } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { useDeleteUserMutation, useResetUserPasswordMutation, type UserDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { EditUserDialog } from "./EditUserDialog";
import { LeaveDialog } from "./LeaveDialog";
import { TemporaryPasswordDialog } from "./TemporaryPasswordDialog";
import "../../api";

type Action = "edit" | "reset" | "leave" | "takeBack" | "delete";

/**
 * The menu of one row of the users table, by what the viewer may do: edit (Users.Update), give a new temporary password
 * (Users.ResetPassword), let leave or take back (Users.Update, by whether the person works here), delete (Users.Delete).
 * The administrator's row offers only edit (the server refuses to reset, let leave or delete them), and nobody's own row
 * offers anything but edit (nobody may let themselves leave, delete themselves or reset their own password here).
 * With nothing to offer there is no menu button at all. The dialogs the items open are owned here. When the server
 * refuses, the confirmations (reset, delete) close and a toast says why (there is nothing to correct); the edit and leave
 * dialogs stay open so the input can be fixed.
 */
export function UserActions({ user }: { user: UserDto }) {
  const { t } = useLocale();
  const { user: me, hasPermission } = useCurrentUser();
  const [open, setOpen] = useState<Action | null>(null);
  // The temporary password lives here and nowhere else, only while its dialog is open; closing it forgets it.
  const [password, setPassword] = useState<string | null>(null);
  const [resetUserPassword, { isLoading: isResetting }] = useResetUserPasswordMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();

  const canChange = hasPermission(Permissions.Users.Update);
  // The server refuses these for the administrator and for oneself.
  const canTouch = !user.isAdministrator && user.id !== me?.id;
  const items: { id: Action; label: string; icon: ReactNode; danger?: boolean }[] = [];
  if (canChange) items.push({ id: "edit", label: t("admin.edit"), icon: <Pencil className="size-4 shrink-0 text-muted" /> });
  if (canTouch && hasPermission(Permissions.Users.ResetPassword)) {
    items.push({ id: "reset", label: t("admin.resetPassword"), icon: <KeyIcon className="size-4 shrink-0 text-muted" /> });
  }
  if (canTouch && canChange) {
    items.push(user.isActive
      ? { id: "leave", label: t("admin.letLeave"), icon: <PersonXmark className="size-4 shrink-0 text-muted" /> }
      : { id: "takeBack", label: t("admin.takeBack"), icon: <ArrowRotateLeft className="size-4 shrink-0 text-muted" /> });
  }
  if (canTouch && hasPermission(Permissions.Users.Delete)) {
    items.push({ id: "delete", label: t("admin.delete"), icon: <TrashBin className="size-4 shrink-0 text-danger" />, danger: true });
  }
  if (items.length === 0) return null;

  const close = () => setOpen(null);

  async function reset() {
    try {
      // The hook's `reset` would do nothing here (it belongs to the render that made this closure, before the request
      // existed), so the request being awaited is the one to reset: the password must not stay in RTK Query's state.
      const pending = resetUserPassword({ id: user.id });
      const { temporaryPassword } = await pending.unwrap();
      pending.reset();
      close();
      setPassword(temporaryPassword);
    } catch (failure) {
      close();
      toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
    }
  }

  async function remove() {
    try {
      await deleteUser({ id: user.id }).unwrap();
      close();
      toast.success(t("admin.userDeleted"));
    } catch (failure) {
      close();
      toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
    }
  }

  return (
    <>
      <Dropdown>
        <Dropdown.Trigger
          aria-label={`${t("admin.rowActions")} · ${user.fullName}`}
          className="tap-target rounded-full p-1.5 text-muted outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Ellipsis className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu aria-label={t("admin.rowActions")} onAction={(key: Key) => setOpen(key as Action)}>
            {items.map((item) => (
              <Dropdown.Item key={item.id} id={item.id} textValue={item.label} variant={item.danger ? "danger" : undefined}>
                {item.icon}
                <Label>{item.label}</Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      {open === "edit" && <EditUserDialog user={user} isOpen onOpenChange={(isOpen) => !isOpen && close()} />}
      {(open === "leave" || open === "takeBack") && <LeaveDialog user={user} mode={open} onClose={close} />}
      {open === "reset" && (
        <ConfirmDialog
          title={t("admin.resetPassword")}
          message={t("admin.resetPasswordConfirm").replace("{name}", user.fullName)}
          confirmLabel={t("admin.resetPassword")}
          isPending={isResetting}
          onConfirm={() => void reset()}
          onClose={close}
        />
      )}
      {open === "delete" && (
        <ConfirmDialog
          title={t("admin.delete")}
          message={t("admin.deleteUserConfirm").replace("{name}", user.fullName)}
          confirmLabel={t("admin.delete")}
          danger
          isPending={isDeleting}
          onConfirm={() => void remove()}
          onClose={close}
        />
      )}
      {password !== null && (
        <TemporaryPasswordDialog password={password} fullName={user.fullName} isOpen onOpenChange={(isOpen) => !isOpen && setPassword(null)} />
      )}
    </>
  );
}

type ConfirmProps = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** A question to confirm before something that cannot be taken back. */
function ConfirmDialog({ title, message, confirmLabel, danger, isPending, onConfirm, onClose }: ConfirmProps) {
  const { t } = useLocale();
  return (
    // Once the request is on its way it cannot be called back, so "no" (Huỷ, Escape, a click outside) is no longer offered.
    <AlertDialog.Backdrop isOpen isDismissable={!isPending} isKeyboardDismissDisabled={isPending} onOpenChange={(isOpen) => !isOpen && !isPending && onClose()}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-sm">
          <AlertDialog.Header>
            <AlertDialog.Icon status={danger ? "danger" : "warning"} />
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>{message}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary" isDisabled={isPending}>
              {t("admin.cancel")}
            </Button>
            <Button variant={danger ? "danger" : "primary"} isPending={isPending} onPress={onConfirm}>
              {confirmLabel}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
