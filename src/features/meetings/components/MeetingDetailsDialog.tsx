"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Modal, Spinner, toast } from "@heroui/react";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { formatBusinessTime } from "../businessTime";
import { addDateDays, businessDate, businessInput } from "../meetingForm";
import { meetingProblem, mutationKey, useMeetingsClient } from "../meetingsClient";
import type { AudiencePerson, EditScope, Meeting } from "../meetingTypes";
import { MeetingSelect } from "./MeetingRecurrenceEditor";

const PAGE_SIZE = 20;

/** A meeting's details, who is invited (a page at a time), and, for its organizer, editing and canceling it. */
export function MeetingDetailsDialog({ meeting, userId, busy, onClose, onEdit, onCanceled }: {
  meeting: Meeting | null;
  userId: number | undefined;
  busy: boolean;
  onClose: () => void;
  onEdit: (meeting: Meeting) => void;
  onCanceled: () => void;
}) {
  const { t, locale } = useLocale();
  const organizer = !!meeting && meeting.organizerId === userId;
  const when = (instant: string, end: boolean) => meeting!.isAllDay
    ? `${end ? addDateDays(businessInput(instant), -1) : businessDate(instant)} · ${end ? t("meetings.endOfDay") : t("meetings.allDay")}`
    : formatBusinessTime(instant, locale);
  return (
    <Modal.Backdrop isOpen={meeting !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <Modal.Container size="lg" placement="center" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("meetings.close")} />
          <Modal.Header><Modal.Heading>{t("meetings.details")}</Modal.Heading></Modal.Header>
          {meeting && (
            <>
              <Modal.Body>
                <dl className="grid gap-4 text-sm">
                  {[
                    [t("meetings.name"), meeting.title], [t("meetings.type"), meeting.kind], [t("meetings.location"), meeting.location],
                    [t("meetings.start"), when(meeting.startUtc, false)], [t("meetings.end"), when(meeting.endUtc, true)],
                  ].map(([label, value]) => <div key={label}><dt className="text-muted">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
                  <div>
                    <dt className="text-muted">{t("meetings.attendees")} · {t("meetings.participantCount").replace("{count}", String(meeting.participantCount))}</dt>
                    <dd className="mt-1"><Participants key={meeting.id} meetingId={meeting.id} /></dd>
                  </div>
                  <p className="text-muted">{organizer ? t("meetings.editHint") : t("meetings.organizerOnly")}</p>
                </dl>
              </Modal.Body>
              <Modal.Footer className="flex-wrap">
                {organizer
                  ? <OrganizerActions key={meeting.id} meeting={meeting} busy={busy} onClose={onClose} onEdit={onEdit} onCanceled={onCanceled} />
                  : <Button variant="secondary" onPress={onClose}>{t("meetings.close")}</Button>}
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Who is invited, read a page at a time (a company-wide meeting has thousands). */
function Participants({ meetingId }: { meetingId: number }) {
  const { t } = useLocale();
  const client = useMeetingsClient();
  const [people, setPeople] = useState<AudiencePerson[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    client.participants(meetingId, page, PAGE_SIZE, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setPeople(previous => [...new Map([...previous, ...result.items].map(person => [person.userId, person])).values()]);
        setTotal(result.totalCount);
        setFailed(false);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [client, meetingId, page, attempt]);

  if (failed) return <div role="alert" className="text-danger">{t("meetings.participantsFailed")} <Button size="sm" variant="tertiary" onPress={() => setAttempt(n => n + 1)}>{t("common.retry")}</Button></div>;
  if (total === null) return <Spinner size="sm" aria-label={t("meetings.loadingPeople")} />;
  if (total === 0) return <span className="text-muted">{t("meetings.noParticipants")}</span>;
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-x-3 gap-y-1 font-medium">{people.map(person => <li key={person.userId}>@{person.fullName}</li>)}</ul>
      {people.length < total && (
        <Button size="sm" variant="ghost" onPress={() => setPage(people.length / PAGE_SIZE + 1)}>
          {t("meetings.showMoreParticipants").replace("{count}", String(total - people.length))}
        </Button>
      )}
    </div>
  );
}

/** Edit, or cancel after confirming (and choosing which occurrences of a series). */
function OrganizerActions({ meeting, busy, onClose, onEdit, onCanceled }: { meeting: Meeting; busy: boolean; onClose: () => void; onEdit: (meeting: Meeting) => void; onCanceled: () => void }) {
  const { t } = useLocale();
  const client = useMeetingsClient();
  const [confirming, setConfirming] = useState(false);
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

  if (!confirming) return (
    <>
      <Button variant="danger-soft" className="mr-auto" isDisabled={busy} onPress={() => setConfirming(true)}>{t("meetings.cancelMeeting")}</Button>
      <Button variant="secondary" onPress={onClose}>{t("meetings.close")}</Button>
      <Button isDisabled={busy} onPress={() => onEdit(meeting)}>{t("meetings.edit")}</Button>
    </>
  );
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
        <Button variant="secondary" isDisabled={canceling} onPress={() => { setConfirming(false); setError(null); }}>{t("meetings.keepMeeting")}</Button>
        <Button variant="danger" isDisabled={canceling} onPress={() => void cancel()}>{canceling ? t("meetings.canceling") : t("meetings.confirmCancel")}</Button>
      </div>
    </div>
  );
}
