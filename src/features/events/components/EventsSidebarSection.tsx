"use client";

import { useId, useMemo } from "react";
import { formatBusinessTime } from "@/features/meetings/businessTime";
import { StatefulTitle } from "@/features/meetings/components/MeetingStateMarks";
import { businessUtc } from "@/features/meetings/meetingForm";
import { meetingState } from "@/features/meetings/meetingState";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { foldVietnamese } from "@/shared/lib/vietnameseSearch";
import { occasionKey, occasionTitle } from "../calendarEntries";
import type { CompanyEvent, Occasion } from "../eventTypes";
import { OccasionIcon } from "./OccasionCard";

type Row = { key: string; start: string; event?: CompanyEvent; occasion?: Occasion };

const dayMonth = { day: "2-digit", month: "2-digit" } as const;
const hourMinute = { hour: "2-digit", minute: "2-digit" } as const;

/**
 * A desktop sidebar's "Sự kiện & dịp": the company events and the birthdays and work anniversaries of the range the
 * calendar shows, by when they start, narrowed by the sidebar's `search`; a row opens the event or the occasion.
 */
export function EventsSidebarSection({ events, occasions, search, now, onOpenEvent, onOpenOccasion }: {
  events: CompanyEvent[];
  occasions: Occasion[];
  search: string;
  /** The calendar's clock (an instant, ms): which events are on or over. */
  now: number;
  onOpenEvent: (event: CompanyEvent) => void;
  onOpenOccasion: (occasion: Occasion) => void;
}) {
  const { t, locale } = useLocale();
  const heading = useId();
  const rows = useMemo(() => {
    const typed = foldVietnamese(search);
    const matches = (...texts: (string | null)[]) => !typed || texts.some(text => text && foldVietnamese(text).includes(typed));
    const all: Row[] = [
      ...events.filter(event => matches(event.title, event.location)).map(event => ({ key: `event:${event.id}`, start: event.startUtc, event })),
      ...occasions.filter(occasion => matches(occasion.fullName, occasionTitle(occasion, t))).map(occasion => ({ key: occasionKey(occasion), start: businessUtc(occasion.date), occasion })),
    ];
    return all.sort((a, b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key));
  }, [events, occasions, search, t]);
  const any = events.length > 0 || occasions.length > 0;
  return (
    <section aria-labelledby={heading} className="flex shrink-0 flex-col gap-2">
      <h3 id={heading} className="text-sm font-semibold">{t("events.sectionTitle")}</h3>
      {rows.length ? (
        <ul className="flex flex-col gap-1">
          {rows.map(row => {
            if (row.event) {
              const event = row.event;
              const state = meetingState(event, now);
              const when = `${formatBusinessTime(event.startUtc, locale, dayMonth)} ${event.isAllDay ? t("meetings.allDay") : formatBusinessTime(event.startUtc, locale, hourMinute)}`;
              return (
                <li key={row.key} data-event-key={row.key} className={state === "finished" ? "meeting-finished" : undefined}>
                  <button type="button" className="event-sidebar-row" onClick={() => onOpenEvent(event)}>
                    <span aria-hidden className={`event-swatch event-${event.category.toLowerCase()} mt-1 size-3 shrink-0 rounded-[0.25rem]`} />
                    <span className="min-w-0 flex-1">
                      <StatefulTitle title={event.title} state={state} liveLabel={t("events.ongoing")} className="text-sm font-medium" />
                      <span className="meeting-row-meta block truncate text-xs text-muted">{when}{event.location ? ` · ${event.location}` : ""}</span>
                    </span>
                  </button>
                </li>
              );
            }
            const occasion = row.occasion!;
            return (
              <li key={row.key} data-event-key={row.key}>
                <button type="button" className="event-sidebar-row" onClick={() => onOpenOccasion(occasion)}>
                  <span className={`occasion-row occasion-${occasion.kind === "Birthday" ? "birthday" : "anniversary"} mt-0.5 flex`}><OccasionIcon occasion={occasion} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium" title={occasionTitle(occasion, t)}>{occasionTitle(occasion, t)}</span>
                    <span className="block truncate text-xs text-muted">{formatBusinessTime(businessUtc(occasion.date), locale, dayMonth)}{occasion.departmentName ? ` · ${occasion.departmentName}` : ""}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted">{any ? t("events.noneFound") : t("events.noneInRange")}</p>
      )}
    </section>
  );
}
