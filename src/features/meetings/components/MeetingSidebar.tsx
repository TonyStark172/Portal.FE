"use client";

import { useCallback, useId, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Button, Checkbox, ScrollShadow, SearchField } from "@heroui/react";
import { EventsSidebarSection } from "@/features/events/components/EventsSidebarSection";
import { occasionDays } from "@/features/events/calendarEntries";
import type { CompanyEvent, Occasion } from "@/features/events/eventTypes";
import { useGetCompanyEventsQuery, useGetMeetingsQuery, useGetOccasionsQuery } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { formatBusinessTime } from "../businessTime";
import { calendarTime } from "../calendarInputs";
import { toMeetingQuery, type MeetingFilters } from "../meetingFilters";
import { businessUtc } from "../meetingForm";
import { meetingDays, meetingRows, visibleMeetings, type MeetingRow } from "../meetingList";
import { rowStates, type MeetingState } from "../meetingState";
import type { Meeting } from "../meetingTypes";
import { StatefulTitle } from "./MeetingStateMarks";
import { MonthPicker } from "./MonthPicker";

/** Where a desktop remembers its sidebar folded away, in this browser. */
export const SIDEBAR_COLLAPSED_KEY = "portal.meetings.sidebarCollapsed";
const CHANGED = "portal:meetings-sidebar";
const readCollapsed = () => {
  try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"; } catch { return false; }
};
const subscribeCollapsed = (notify: () => void) => {
  window.addEventListener("storage", notify);
  window.addEventListener(CHANGED, notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener(CHANGED, notify); };
};

/** Whether the viewer folded the sidebar away (remembered in the browser); open on the server and while hydrating. */
export function useSidebarCollapsed(): [boolean, (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const setCollapsed = useCallback((next: boolean) => {
    try {
      if (next) localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
      else localStorage.removeItem(SIDEBAR_COLLAPSED_KEY);
    } catch { /* not remembered: private mode or blocked storage */ }
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return [collapsed, setCollapsed];
}

/** The first day of the month after `month` (yyyy-mm). */
const nextMonth = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 7);
};

type MeetingSidebarProps = {
  id: string;
  /** The day the calendar is on (yyyy-mm-dd). */
  date: string;
  /** The meetings of the range the calendar shows, hidden ones too. */
  meetings: Meeting[];
  /** The company events and the occasions (public holidays, the company's birthday, birthdays) of the range the calendar shows. */
  events: CompanyEvent[];
  occasions: Occasion[];
  /** The calendar's clock (an instant, ms): which rows are on or over. */
  now: number;
  filters: MeetingFilters;
  hidden: readonly string[];
  busy: boolean;
  onPick: (date: string) => void;
  onHidden: (hidden: string[]) => void;
  onOpenEvent: (event: CompanyEvent) => void;
  onOpenOccasion: (occasion: Occasion) => void;
};

/**
 * A desktop's column left of the calendar: a month that moves the calendar (a dot on the days with meetings, events or
 * occasions, asked for with the calendar's filters), a search, the meetings of the range shown, one per meeting or
 * series, each ticked while the calendar shows it, and then its company events, holidays and birthdays.
 */
export function MeetingSidebar({ id, date, meetings, events, occasions, now, filters, hidden, busy, onPick, onHidden, onOpenEvent, onOpenOccasion }: MeetingSidebarProps) {
  const { t } = useLocale();
  // The day focused in the month follows the calendar's day; the month's arrows move it on their own.
  const [focused, setFocused] = useState(date);
  const [followed, setFollowed] = useState(date);
  if (followed !== date) { setFollowed(date); setFocused(date); }
  const month = focused.slice(0, 7);
  const monthRange = { fromUtc: businessUtc(`${month}-01`), toUtc: businessUtc(`${nextMonth(month)}-01`) };
  const { show } = filters;
  const { data: monthMeetings } = useGetMeetingsQuery(toMeetingQuery(filters, monthRange.fromUtc, monthRange.toUtc), { skip: !show.meetings });
  const { data: monthEvents } = useGetCompanyEventsQuery(monthRange, { skip: !show.events });
  const { data: monthOccasions } = useGetOccasionsQuery(monthRange, { skip: !show.occasions });
  const marked = useMemo(() => new Set([
    ...show.meetings ? meetingDays(visibleMeetings(monthMeetings ?? [], hidden)) : [],
    ...show.events ? meetingDays(monthEvents ?? []) : [],
    // A holiday marks each of its days.
    ...show.occasions ? (monthOccasions ?? []).flatMap(occasionDays) : [],
  ]), [monthMeetings, monthEvents, monthOccasions, hidden, show]);

  const [search, setSearch] = useState("");
  const rows = useMemo(() => meetingRows(meetings, search), [meetings, search]);
  const states = useMemo(() => rowStates(meetings, now), [meetings, now]);
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const anyHidden = rows.some(row => hiddenSet.has(row.key));
  const listed = new Set(rows.map(row => row.key));
  const showAll = () => onHidden(hidden.filter(key => !listed.has(key)));
  const hideAll = () => onHidden([...hidden, ...rows.map(row => row.key).filter(key => !hiddenSet.has(key))]);
  const toggle = (key: string, shown: boolean) => onHidden(shown ? hidden.filter(other => other !== key) : [...hidden, key]);
  const listHeading = useId();

  return (
    <aside id={id} aria-label={t("meetings.sidebar")} className="meeting-sidebar">
      <MonthPicker date={date} focused={focused} today={calendarTime(new Date()).slice(0, 10)} marked={marked} busy={busy}
        onPick={day => { setFocused(day); onPick(day); }} onFocus={setFocused} />
      {/* The month stays put; only what is under it scrolls, its edges fading out (HeroUI's ScrollShadow) beside a thin
          themed scrollbar. */}
      <ScrollShadow size={24} className="meeting-sidebar-scroll">
        <SearchField aria-label={t("meetings.findMeeting")} value={search} onChange={setSearch} maxLength={100} className="w-full">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={t("meetings.findMeeting")} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        {show.meetings && <section aria-labelledby={listHeading} className="flex shrink-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 id={listHeading} className="text-sm font-semibold">{t("meetings.meetingList")}</h3>
            {rows.length > 0 && (
              <Button size="sm" variant="ghost" className="meeting-sidebar-all" onPress={anyHidden ? showAll : hideAll}>
                {anyHidden ? t("meetings.showAll") : t("meetings.hideAll")}
              </Button>
            )}
          </div>
          {rows.length ? (
            <ul className="meeting-sidebar-list flex flex-col gap-1">
              {rows.map(row => <MeetingListRow key={row.key} row={row} state={states.get(row.key) ?? "upcoming"} shown={!hiddenSet.has(row.key)} onChange={shown => toggle(row.key, shown)} />)}
            </ul>
          ) : (
            <p className="text-xs text-muted">{meetings.length ? t("meetings.noMeetingsFound") : t("meetings.noMeetingsInRange")}</p>
          )}
        </section>}
        {(show.events || show.occasions) && (
          <EventsSidebarSection events={events} occasions={occasions} search={search} now={now} onOpenEvent={onOpenEvent} onOpenOccasion={onOpenOccasion} />
        )}
      </ScrollShadow>
    </aside>
  );
}

const dayMonth = { day: "2-digit", month: "2-digit" } as const;
const hourMinute = { hour: "2-digit", minute: "2-digit" } as const;

/**
 * A meeting or series: ticked while the calendar shows it, its box in the meeting's colour; its first time and room under
 * it. Faded and struck through once it is over, tagged while it is on.
 */
function MeetingListRow({ row, state, shown, onChange }: { row: MeetingRow; state: MeetingState; shown: boolean; onChange: (shown: boolean) => void }) {
  const { locale, t } = useLocale();
  const when = `${formatBusinessTime(row.startUtc, locale, dayMonth)} ${row.isAllDay ? t("meetings.allDay") : formatBusinessTime(row.startUtc, locale, hourMinute)}`;
  return (
    <li data-meeting-key={row.key}>
      <Checkbox isSelected={shown} onChange={onChange} className="meeting-sidebar-check w-full" style={{ "--meeting-color": row.color } as CSSProperties}>
        <Checkbox.Content className={`flex w-full min-w-0 cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 ${state === "finished" ? "meeting-finished" : ""}`}>
          <Checkbox.Control className="mt-0.5"><Checkbox.Indicator /></Checkbox.Control>
          <span className="min-w-0 flex-1">
            <StatefulTitle title={row.title} state={state} className="text-sm font-medium" />
            <span className="block truncate text-xs text-muted">{when} · {row.location}</span>
          </span>
        </Checkbox.Content>
      </Checkbox>
    </li>
  );
}
