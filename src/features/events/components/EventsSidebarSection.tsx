"use client";

import { useId, useMemo } from "react";
import { formatBusinessTime } from "@/features/meetings/businessTime";
import { StatefulTitle } from "@/features/meetings/components/MeetingStateMarks";
import { businessUtc } from "@/features/meetings/meetingForm";
import { meetingState } from "@/features/meetings/meetingState";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { foldVietnamese } from "@/shared/lib/vietnameseSearch";
import { locationLabel } from "../eventLocation";
import { byOccasionRank, occasionKey, occasionState, occasionTitle, occasionTone } from "../calendarEntries";
import type { CompanyEvent, Occasion } from "../eventTypes";
import { OccasionIcon, occasionDates } from "./OccasionCard";

type Row = { key: string; start: string; event?: CompanyEvent; occasion?: Occasion };
/** Same start: events, then holidays, the company's birthday and people's. */
const rowOrder = (a: Row, b: Row) => a.start.localeCompare(b.start)
  || (a.occasion && b.occasion ? byOccasionRank(a.occasion, b.occasion) : Number(!!a.occasion) - Number(!!b.occasion)) || a.key.localeCompare(b.key);
/** What an occasion's row is found by: its title, and a person's or the company's name. */
const occasionTexts = (occasion: Occasion, t: (key: string) => string) =>
  [occasionTitle(occasion, t), occasion.kind === "Birthday" ? occasion.fullName : occasion.kind === "CompanyAnniversary" ? occasion.organizationName : null];

const dayMonth = { day: "2-digit", month: "2-digit" } as const;
const hourMinute = { hour: "2-digit", minute: "2-digit" } as const;

/**
 * A desktop sidebar's "Sự kiện & dịp": the company events, public holidays (a row for all of a holiday's days), the
 * company's birthday and people's of the range the calendar shows, by when they start, narrowed by the sidebar's
 * `search`; a row opens the event or the occasion. A holiday over is faded as an event is.
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
      ...events.filter(event => matches(event.title, locationLabel(event.location))).map(event => ({ key: `event:${event.id}`, start: event.startUtc, event })),
      ...occasions.filter(occasion => matches(...occasionTexts(occasion, t))).map(occasion => ({ key: occasionKey(occasion), start: businessUtc(occasion.date), occasion })),
    ];
    return all.sort(rowOrder);
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
                      <span className="meeting-row-meta block truncate text-xs text-muted">{when}{event.location ? ` · ${locationLabel(event.location)}` : ""}</span>
                    </span>
                  </button>
                </li>
              );
            }
            const occasion = row.occasion!;
            const title = occasionTitle(occasion, t);
            const department = occasion.kind === "Birthday" && occasion.departmentName ? ` · ${occasion.departmentName}` : "";
            const finished = occasionState(occasion, now) === "finished";
            return (
              <li key={row.key} data-event-key={row.key} className={finished ? "meeting-finished" : undefined}>
                <button type="button" className="event-sidebar-row" onClick={() => onOpenOccasion(occasion)}>
                  <span className={`occasion-row occasion-${occasionTone(occasion)} mt-0.5 flex`}><OccasionIcon occasion={occasion} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="meeting-row-title block truncate text-sm font-medium" title={title}>{title}{finished && <span className="sr-only"> {t("meetings.finishedNote")}</span>}</span>
                    <span className="meeting-row-meta block truncate text-xs text-muted">{occasionDates(occasion, locale)}{department}</span>
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
