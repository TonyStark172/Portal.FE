"use client";

import { useState } from "react";
import { Button, Drawer, Modal, toast } from "@heroui/react";
import { MapPin, Pencil, Persons, Tag, TextAlignLeft, TrashBin, Xmark } from "@gravity-ui/icons";
import { useCurrentUser } from "@/features/auth";
import { IconAction, Row, meetingWhen } from "@/features/meetings/components/MeetingDetailsDialog";
import { LiveDot } from "@/features/meetings/components/MeetingStateMarks";
import { meetingProblem } from "@/features/meetings/meetingsClient";
import { meetingState } from "@/features/meetings/meetingState";
import { Permissions } from "@/shared/auth/permissions";
import { usePhone } from "@/shared/hooks/usePhone";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { useEventsClient } from "../eventsClient";
import type { CompanyEvent, CompanyEventCategory } from "../eventTypes";

export const categoryLabel = (category: CompanyEventCategory, t: (key: string) => string) => t(`events.category.${category}`);

/** Who an event is for: "Toàn công ty", or its departments by name. */
export const audienceLabel = (event: CompanyEvent, t: (key: string) => string) =>
  event.departments.length ? event.departments.map(department => department.name).join(", ") : t("events.wholeCompany");

/**
 * A company event's details: its title and when, then where, its category, who it is for and its description; whether
 * it is on or over at `now`. Those allowed to manage events (Events.Manage) edit or delete it from the icons at the top;
 * deleting asks first. A centred dialog, or a sheet from the bottom on a phone.
 */
export function CompanyEventDetailsDialog({ event, now, busy, onClose, onEdit, onDeleted }: {
  event: CompanyEvent | null;
  now: number;
  busy: boolean;
  onClose: () => void;
  onEdit: (event: CompanyEvent) => void;
  onDeleted: () => void;
}) {
  const phone = usePhone();
  const isOpen = event !== null;
  const onOpenChange = (open: boolean) => { if (!open) onClose(); };
  const details = event && <Details key={event.id} event={event} now={now} busy={busy} phone={phone} onClose={onClose} onEdit={onEdit} onDeleted={onDeleted} />;
  if (phone) return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="bottom">
        <Drawer.Dialog className="max-h-[85dvh]">
          <Drawer.Handle />
          {details}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="md" placement="center" scroll="inside">
        <Modal.Dialog>{details}</Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function Details({ event, now, busy, phone, onClose, onEdit, onDeleted }: {
  event: CompanyEvent; now: number; busy: boolean; phone: boolean; onClose: () => void; onEdit: (event: CompanyEvent) => void; onDeleted: () => void;
}) {
  const { t, locale } = useLocale();
  const { hasPermission } = useCurrentUser();
  const canManage = event.canManage && hasPermission(Permissions.Events.Manage);
  const [confirming, setConfirming] = useState(false);
  const state = meetingState(event, now);
  const Heading = phone ? Drawer.Heading : Modal.Heading;
  const Body = phone ? Drawer.Body : Modal.Body;
  return (
    <>
      <div className="-mt-2 -mr-2 flex shrink-0 items-center justify-end gap-1">
        {canManage && <>
          <IconAction label={t("events.edit")} icon={Pencil} disabled={busy} onPress={() => onEdit(event)} />
          <IconAction label={t("events.delete")} icon={TrashBin} danger disabled={busy || confirming} onPress={() => setConfirming(true)} />
        </>}
        <IconAction label={t("meetings.close")} icon={Xmark} onPress={onClose} />
      </div>
      <Body className="flex flex-col gap-4 text-sm">
        <div className="flex gap-3">
          <span aria-hidden className={`event-swatch event-${event.category.toLowerCase()} mt-1.5 size-3 shrink-0 rounded-[0.25rem]`} />
          <div className="min-w-0">
            <Heading className="break-words text-lg font-semibold leading-snug">{event.title}</Heading>
            <p className="mt-0.5 text-muted">{meetingWhen(event, locale, t("meetings.allDay"))}</p>
            {state === "ongoing" && <p className="mt-1 flex items-center font-medium text-danger"><LiveDot />{t("events.ongoing")}</p>}
            {state === "finished" && <p className="mt-1 text-muted">{t("meetings.finished")}</p>}
          </div>
        </div>
        {event.location && <Row icon={MapPin}><span className="break-words">{event.location}</span></Row>}
        <Row icon={Tag}><span className="break-words">{categoryLabel(event.category, t)}</span></Row>
        <Row icon={Persons}><span className="break-words">{audienceLabel(event, t)}</span></Row>
        {event.description && <Row icon={TextAlignLeft}><p className="whitespace-pre-wrap break-words">{event.description}</p></Row>}
        {confirming && <DeleteConfirm event={event} onKeep={() => setConfirming(false)} onDeleted={onDeleted} />}
      </Body>
    </>
  );
}

/** Deletes the event for good, once confirmed. */
function DeleteConfirm({ event, onKeep, onDeleted }: { event: CompanyEvent; onKeep: () => void; onDeleted: () => void }) {
  const { t } = useLocale();
  const client = useEventsClient();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await client.remove(event.id);
      toast.success(t("events.deleted"));
      onDeleted();
    } catch (failure) {
      setError(meetingProblem(failure).detail ?? t("events.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div role="alertdialog" aria-label={t("events.deleteConfirmTitle")} className="w-full space-y-3 rounded-xl border border-danger/25 bg-danger/5 p-3">
      <p className="font-medium">{t("events.deleteConfirmTitle")}</p>
      <p className="text-sm text-muted">{t("events.deleteConfirmText")}</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" isDisabled={deleting} onPress={onKeep}>{t("events.keep")}</Button>
        <Button variant="danger" isDisabled={deleting} onPress={() => void remove()}>{deleting ? t("events.deleting") : t("events.confirmDelete")}</Button>
      </div>
    </div>
  );
}
