"use client";

import { useState, type Key, type ReactNode } from "react";
import { ArrowRotateRight, CircleXmark, Ellipsis } from "@gravity-ui/icons";
import { Dropdown, Label, toast } from "@heroui/react";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { useAppDispatch } from "@/core/hooks";
import { portalApi, useResendInvitationMutation, useRevokeInvitationMutation, type InvitationDto } from "@/shared/api/generated/portalApi";
import "../../api";
import { ConfirmDialog } from "../ConfirmDialog";

type Action = "resend" | "revoke";

/**
 * The menu of an invitation's row, for whoever holds Users.Create: send again (a new link, two more days; also for one
 * that ran out) and, while it is pending, revoke (asked first: the link stops working). A toast says how it went. A refusal
 * (409: taken up, revoked, or the address got an account meanwhile) means the row is out of date: the list reads again.
 */
export function InvitationActions({ invitation }: { invitation: InvitationDto }) {
  const { t } = useLocale();
  const dispatch = useAppDispatch();
  const [confirming, setConfirming] = useState(false);
  const [resendInvitation] = useResendInvitationMutation();
  const [revokeInvitation, { isLoading: isRevoking }] = useRevokeInvitationMutation();

  const items: { id: Action; label: string; icon: ReactNode; danger?: boolean }[] = [
    { id: "resend", label: t("admin.invite.resend"), icon: <ArrowRotateRight className="size-4 shrink-0 text-muted" /> },
  ];
  if (invitation.status === "Pending") {
    items.push({ id: "revoke", label: t("admin.invite.revoke"), icon: <CircleXmark className="size-4 shrink-0 text-danger" />, danger: true });
  }

  function refused(failure: unknown) {
    toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
    dispatch(portalApi.util.invalidateTags(["Invitations", "Users"]));
  }

  async function resend() {
    try {
      await resendInvitation({ id: invitation.id }).unwrap();
      toast.success(t("admin.invite.resent").replace("{email}", invitation.email));
    } catch (failure) {
      refused(failure);
    }
  }

  async function revoke() {
    try {
      await revokeInvitation({ id: invitation.id }).unwrap();
      toast.success(t("admin.invite.revoked").replace("{email}", invitation.email));
    } catch (failure) {
      refused(failure);
    }
    setConfirming(false);
  }

  return (
    <>
      <Dropdown>
        <Dropdown.Trigger
          aria-label={`${t("admin.rowActions")} · ${invitation.email}`}
          className="tap-target rounded-full p-1.5 text-muted outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Ellipsis className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu
            aria-label={t("admin.rowActions")}
            onAction={(key: Key) => (key === "resend" ? void resend() : setConfirming(true))}
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

      {confirming && (
        <ConfirmDialog
          title={t("admin.invite.revokeTitle")}
          message={t("admin.invite.revokeConfirm").replace("{email}", invitation.email)}
          confirmLabel={t("admin.invite.revoke")}
          danger
          isPending={isRevoking}
          onConfirm={() => void revoke()}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
