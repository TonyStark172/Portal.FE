"use client";

import { Modal } from "@heroui/react";
import { occasionTitle } from "@/features/events/calendarEntries";
import { OccasionIcon } from "@/features/events/components/OccasionCard";
import type { CompanyEvent, Occasion } from "@/features/events/eventTypes";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { BUSINESS_OFFSET, formatBusinessTime } from "../businessTime";
import type { MoreItems } from "../calendarCapacity";
import { meetingState } from "../meetingState";
import type { Meeting } from "../meetingTypes";
import { StatefulTitle } from "./MeetingStateMarks";

/** A business date ("2026-10-11") as the reader says it: "Chủ Nhật, 11/10/2026". */
const dayLabel = (day: string, locale: string) =>
  formatBusinessTime(`${day}T12:00:00${BUSINESS_OFFSET}`, locale, { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
const hourMinute = { hour: "2-digit", minute: "2-digit" } as const;

/** A day's list: its meetings, and the company events and occasions of the day when a phone's day is opened. */
export type DayList = MoreItems<Meeting> & { events?: CompanyEvent[]; occasions?: Occasion[] };

const rowClass = "w-full rounded-lg px-2 py-2 text-left outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus";

/**
 * The meetings a crowded day or time slot left out of the calendar ("+N"), or everything a phone's day holds (its
 * company events and birthdays and anniversaries after its meetings); picking one opens its details. Each meeting and
 * event shows its state at `now` (the calendar's clock, ms): faded and struck through once over, tagged while on.
 */
export function DayMeetingsDialog({ group, now, onClose, onOpen, onOpenEvent, onOpenOccasion }: {
  group: DayList | null;
  now: number;
  onClose: () => void;
  onOpen: (meeting: Meeting) => void;
  onOpenEvent?: (event: CompanyEvent) => void;
  onOpenOccasion?: (occasion: Occasion) => void;
}) {
  const { t, locale } = useLocale();
  const events = group?.events ?? [];
  const occasions = group?.occasions ?? [];
  const mixed = events.length > 0 || occasions.length > 0;
  const time = (item: { isAllDay: boolean; startUtc: string; endUtc: string }) =>
    item.isAllDay ? t("meetings.allDay") : `${formatBusinessTime(item.startUtc, locale, hourMinute)} – ${formatBusinessTime(item.endUtc, locale, hourMinute)}`;
  return (
    <Modal.Backdrop isOpen={group !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <Modal.Container size="md" placement="center" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("meetings.close")} />
          <Modal.Header><Modal.Heading>{group && t(mixed ? "events.dayTitle" : "meetings.dayMeetings").replace("{date}", dayLabel(group.day, locale))}</Modal.Heading></Modal.Header>
          <Modal.Body>
            <ul className="divide-y divide-separator">
              {group?.items.map(meeting => (
                <li key={meeting.id}>
                  <button type="button" className={`${rowClass} ${meetingState(meeting, now) === "finished" ? "meeting-finished" : ""}`}
                    onClick={() => onOpen(meeting)}>
                    <StatefulTitle title={meeting.title} state={meetingState(meeting, now)} className="font-medium" />
                    <span className="block truncate text-xs text-muted">{time(meeting)}{" · "}{meeting.location}</span>
                  </button>
                </li>
              ))}
              {events.map(event => (
                <li key={`event:${event.id}`}>
                  <button type="button" className={`${rowClass} ${meetingState(event, now) === "finished" ? "meeting-finished" : ""}`} onClick={() => onOpenEvent?.(event)}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden className={`event-swatch event-${event.category.toLowerCase()} size-2.5 shrink-0 rounded-[0.1875rem]`} />
                      <StatefulTitle title={event.title} state={meetingState(event, now)} liveLabel={t("events.ongoing")} className="min-w-0 font-medium" />
                    </span>
                    <span className="block truncate text-xs text-muted">{time(event)}{event.location ? ` · ${event.location}` : ""}</span>
                  </button>
                </li>
              ))}
              {occasions.map(occasion => (
                <li key={`occasion:${occasion.kind}:${occasion.userId}`}>
                  <button type="button" className={rowClass} onClick={() => onOpenOccasion?.(occasion)}>
                    <span className={`occasion-row occasion-${occasion.kind === "Birthday" ? "birthday" : "anniversary"} flex min-w-0 items-center gap-2 font-medium`}>
                      <OccasionIcon occasion={occasion} /><span className="min-w-0 truncate">{occasionTitle(occasion, t)}</span>
                    </span>
                    {occasion.departmentName && <span className="block truncate text-xs text-muted">{occasion.departmentName}</span>}
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
