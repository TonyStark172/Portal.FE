"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode, type RefObject } from "react";
import { AvatarGroup, Button, Drawer, Modal, Skeleton, Tooltip, toast } from "@heroui/react";
import { ArrowsRotateRight, CircleInfo, MapPin, Pencil, Persons, Tag, TrashBin, Xmark } from "@gravity-ui/icons";
import { usePhone } from "@/shared/hooks/usePhone";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { BUSINESS_OFFSET, formatBusinessTime } from "../businessTime";
import { meetingTone } from "../calendarInputs";
import { addDateDays, businessDate, businessInput } from "../meetingForm";
import { meetingProblem, mutationKey, useMeetingsClient } from "../meetingsClient";
import type { AudiencePerson, EditScope, Meeting } from "../meetingTypes";
import { MeetingSelect } from "./MeetingRecurrenceEditor";

const PAGE_SIZE = 20;
/** A small avatar (HeroUI's `sm`, 2rem) and how much the next one in a group covers it (`--avatar-group-overlap`). */
const FACE = 32;
const OVERLAP = 8;
const TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
const DAY: Intl.DateTimeFormatOptions = { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" };
const DATE: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/**
 * When a meeting is, on one line: "Thứ Hai, 07/01/2030 · 09:00 – 10:00" within a day, both ends in full over several
 * days, the dates alone when it lasts all day (its end is exclusive, so the last day is the one before).
 */
function meetingWhen(meeting: Meeting, locale: string, allDay: string) {
  if (meeting.isAllDay) {
    const first = businessDate(meeting.startUtc);
    const last = addDateDays(businessInput(meeting.endUtc), -1);
    const date = (day: string, options: Intl.DateTimeFormatOptions) => formatBusinessTime(`${day}T12:00:00${BUSINESS_OFFSET}`, locale, options);
    return `${last <= first ? capitalize(date(first, DAY)) : `${date(first, DATE)} – ${date(last, DATE)}`} · ${allDay}`;
  }
  if (businessDate(meeting.startUtc) !== businessDate(meeting.endUtc))
    return `${formatBusinessTime(meeting.startUtc, locale)} – ${formatBusinessTime(meeting.endUtc, locale)}`;
  return `${capitalize(formatBusinessTime(meeting.startUtc, locale, DAY))} · ${formatBusinessTime(meeting.startUtc, locale, TIME)} – ${formatBusinessTime(meeting.endUtc, locale, TIME)}`;
}

/**
 * A meeting's details, read like an event in a calendar app: its title, when on one line, then where, what kind and
 * who; its organizer edits or cancels it from the icons at the top. A centred dialog, or a sheet from the bottom on
 * a phone.
 */
export function MeetingDetailsDialog({ meeting, userId, busy, onClose, onEdit, onCanceled }: {
  meeting: Meeting | null;
  userId: number | undefined;
  busy: boolean;
  onClose: () => void;
  onEdit: (meeting: Meeting) => void;
  onCanceled: () => void;
}) {
  const phone = usePhone();
  const isOpen = meeting !== null;
  const onOpenChange = (open: boolean) => { if (!open) onClose(); };
  const details = meeting && <Details key={meeting.id} meeting={meeting} userId={userId} busy={busy} phone={phone} onClose={onClose} onEdit={onEdit} onCanceled={onCanceled} />;
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

function Details({ meeting, userId, busy, phone, onClose, onEdit, onCanceled }: {
  meeting: Meeting; userId: number | undefined; busy: boolean; phone: boolean;
  onClose: () => void; onEdit: (meeting: Meeting) => void; onCanceled: () => void;
}) {
  const { t, locale } = useLocale();
  const organizer = meeting.organizerId === userId;
  const [confirming, setConfirming] = useState(false);
  const Heading = phone ? Drawer.Heading : Modal.Heading;
  const Body = phone ? Drawer.Body : Modal.Body;
  return (
    <>
      <div className="-mt-2 -mr-2 flex shrink-0 items-center justify-end gap-1">
        {organizer && <>
          <IconAction label={t("meetings.edit")} icon={Pencil} disabled={busy} onPress={() => onEdit(meeting)} />
          <IconAction label={t("meetings.cancelMeeting")} icon={TrashBin} danger disabled={busy || confirming} onPress={() => setConfirming(true)} />
        </>}
        <IconAction label={t("meetings.close")} icon={Xmark} onPress={onClose} />
      </div>
      <Body className="flex flex-col gap-4 text-sm">
        <div className="flex gap-3">
          <span aria-hidden className={`meeting-swatch meeting-tone-${meetingTone(meeting)} mt-1.5 size-3 shrink-0 rounded-[0.25rem]`} />
          <div className="min-w-0">
            <Heading className="break-words text-lg font-semibold leading-snug">{meeting.title}</Heading>
            <p className="mt-0.5 text-muted">{meetingWhen(meeting, locale, t("meetings.allDay"))}</p>
          </div>
        </div>
        <Row icon={MapPin}><span className="break-words">{meeting.location}</span></Row>
        <Row icon={Tag}><span className="break-words">{meeting.kind}</span></Row>
        {meeting.seriesId && <Row icon={ArrowsRotateRight}>{t("meetings.recurring")}</Row>}
        <Row icon={Persons}><Participants meetingId={meeting.id} count={meeting.participantCount} /></Row>
        {confirming && <CancelConfirm meeting={meeting} onKeep={() => setConfirming(false)} onCanceled={onCanceled} />}
        {/* Dragging on the calendar is for a mouse: the hint is left out on a phone. */}
        <p className={`flex gap-2 text-xs text-muted ${organizer ? "max-md:hidden" : ""}`}>
          <CircleInfo aria-hidden className="mt-px size-3.5 shrink-0" />
          {organizer ? t("meetings.editHint") : t("meetings.organizerOnly")}
        </p>
      </Body>
    </>
  );
}

/** An action at the top of the details: an icon named in a tooltip, with a 40px tap on a phone. */
function IconAction({ label, icon: Icon, danger, disabled, onPress }: {
  label: string; icon: ComponentType<{ className?: string }>; danger?: boolean; disabled?: boolean; onPress: () => void;
}) {
  return (
    <Tooltip delay={400}>
      <Button size="sm" variant="ghost" isIconOnly aria-label={label} isDisabled={disabled} className={`tap-target ${danger ? "text-danger" : ""}`} onPress={onPress}>
        <Icon className="size-4" />
      </Button>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}

function Row({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <div className="flex min-w-0 gap-3">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * Who is invited, as one row of faces: as many as the line holds, the others counted ("+9"). Only the first page is
 * read; the count is the server's total, which also replaces the calendar's figure once known (it may be older).
 */
function Participants({ meetingId, count }: { meetingId: number; count: number }) {
  const { t } = useLocale();
  const client = useMeetingsClient();
  const [people, setPeople] = useState<AudiencePerson[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    client.participants(meetingId, 1, PAGE_SIZE, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setPeople(result.items);
        setTotal(result.totalCount);
        setFailed(false);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [client, meetingId, attempt]);
  const box = useRef<HTMLDivElement>(null);
  const room = useWidth(box);

  // As many faces as the line holds; when not everyone fits, the last place is the count of the others.
  const places = Math.max(1, Math.floor((room - FACE) / (FACE - OVERLAP)) + 1);
  let faces: ReactNode;
  if (failed) faces = <div role="alert" className="text-danger">{t("meetings.participantsFailed")} <Button size="sm" variant="tertiary" onPress={() => setAttempt(n => n + 1)}>{t("common.retry")}</Button></div>;
  else if (total === null) faces = (
    <div role="status" aria-label={t("meetings.loadingAttendees")} className="flex">
      {Array.from({ length: Math.min(5, Math.max(1, count), places) }, (_, i) => <Skeleton key={i} className="size-8 rounded-full not-first:-ms-2" />)}
    </div>
  );
  else if (total === 0) faces = <span className="text-muted">{t("meetings.noParticipants")}</span>;
  else {
    const shown = Math.min(people.length, total <= places ? total : places - 1);
    const names = people.map(person => person.fullName).join(", ") + (total > people.length ? ` +${total - people.length}` : "");
    const label = `${t("meetings.attendees")}: ${names}`;
    faces = (
      <AvatarGroup size="sm" overlap="ring" role="img" aria-label={label} title={names} className="max-w-full">
        {people.slice(0, shown).map(person => <UserAvatar key={person.userId} fullName={person.fullName} avatarUrl={person.avatarUrl} />)}
        {total > shown && <AvatarGroup.Count>+{total - shown}</AvatarGroup.Count>}
      </AvatarGroup>
    );
  }
  return (
    <div ref={box} className="flex min-w-0 flex-col gap-2">
      <span>{t("meetings.participantCount").replace("{count}", String(total ?? count))}</span>
      {faces}
    </div>
  );
}

/** The width of an element, kept up to date as it is resized (0 until it is laid out). */
function useWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Measured now, before paint: the observer reports only after a frame, which would show "+N" with no faces.
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Cancels after confirming (and choosing which occurrences of a series). */
function CancelConfirm({ meeting, onKeep, onCanceled }: { meeting: Meeting; onKeep: () => void; onCanceled: () => void }) {
  const { t } = useLocale();
  const client = useMeetingsClient();
  const [scope, setScope] = useState<EditScope>("Occurrence");
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useRef<{ fingerprint: string; id: string } | null>(null);

  const cancel = async () => {
    setCanceling(true);
    setError(null);
    const request = { id: meeting.id, scope, expectedVersion: meeting.version, expectedSeriesVersion: meeting.seriesVersion ?? undefined };
    mutation.current = mutationKey(mutation.current, request);
    try {
      await client.cancel({ ...request, mutationId: mutation.current.id });
      toast.success(t("meetings.canceled"));
      onCanceled();
    } catch (failure) {
      setError(meetingProblem(failure).detail ?? t("meetings.cancelFailed"));
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div role="alertdialog" aria-label={t("meetings.cancelConfirmTitle")} className="w-full space-y-3 rounded-xl border border-danger/25 bg-danger/5 p-3">
      <p className="font-medium">{t("meetings.cancelConfirmTitle")}</p>
      <p className="text-sm text-muted">{t("meetings.cancelConfirmText")}</p>
      {meeting.seriesId && (
        <MeetingSelect label={t("meetings.cancelScope")} value={scope} disabled={canceling} onChange={next => setScope(next as EditScope)}
          options={[["Occurrence", t("meetings.scopeOccurrence")], ["Following", t("meetings.scopeFollowing")], ["Series", t("meetings.scopeSeries")]]} />
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" isDisabled={canceling} onPress={onKeep}>{t("meetings.keepMeeting")}</Button>
        <Button variant="danger" isDisabled={canceling} onPress={() => void cancel()}>{canceling ? t("meetings.canceling") : t("meetings.confirmCancel")}</Button>
      </div>
    </div>
  );
}
