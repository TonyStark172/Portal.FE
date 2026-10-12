"use client";

import { Modal } from "@heroui/react";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { BUSINESS_OFFSET, formatBusinessTime } from "../businessTime";
import type { MoreItems } from "../calendarCapacity";
import type { Meeting } from "../meetingTypes";

/** A business date ("2026-10-11") as the reader says it: "Chủ Nhật, 11/10/2026". */
const dayLabel = (day: string, locale: string) =>
  formatBusinessTime(`${day}T12:00:00${BUSINESS_OFFSET}`, locale, { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });

/** The meetings a crowded day or time slot left out of the calendar ("+N"); picking one opens its details. */
export function DayMeetingsDialog({ group, onClose, onOpen }: { group: MoreItems<Meeting> | null; onClose: () => void; onOpen: (meeting: Meeting) => void }) {
  const { t, locale } = useLocale();
  return (
    <Modal.Backdrop isOpen={group !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <Modal.Container size="md" placement="center" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("meetings.close")} />
          <Modal.Header><Modal.Heading>{group && t("meetings.dayMeetings").replace("{date}", dayLabel(group.day, locale))}</Modal.Heading></Modal.Header>
          <Modal.Body>
            <ul className="divide-y divide-separator">
              {group?.items.map(meeting => (
                <li key={meeting.id}>
                  <button type="button" className="w-full rounded-lg px-2 py-2 text-left outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
                    onClick={() => onOpen(meeting)}>
                    <span className="block truncate font-medium">{meeting.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {meeting.isAllDay ? t("meetings.allDay") : `${formatBusinessTime(meeting.startUtc, locale, { hour: "2-digit", minute: "2-digit" })} – ${formatBusinessTime(meeting.endUtc, locale, { hour: "2-digit", minute: "2-digit" })}`}
                      {" · "}{meeting.location}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
