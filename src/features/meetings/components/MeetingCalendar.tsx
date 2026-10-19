"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Modal, toast } from "@heroui/react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import viLocale from "@fullcalendar/core/locales/vi";
import type { DatesSetArg, EventApi, EventClickArg, EventContentArg, EventMountArg, EventSourceFuncArg, DayHeaderContentArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import { useCurrentUser } from "@/features/auth";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { canMoveMeeting, createOccurrenceSaver, createTimeChangeHandler } from "../calendarEvents";
import { calendarInputs, calendarTime, serverTime, showsDots, type MoreProps } from "../calendarInputs";
import { meetingsOfDay, type MoreItems } from "../calendarCapacity";
import { compactTitle } from "../calendarTitles";
import { defaultView, isCalendarView, layoutOf, rangeOf, readCalendarState, toMeetingQuery, viewOf, writeCalendarState, type MeetingFilters } from "../meetingFilters";
import { editScopeOf, fromMeeting, newMeetingForm, toMeetingWriteRequest } from "../meetingForm";
import { visibleMeetings } from "../meetingList";
import { meetingProblem, mutationKey, useMeetingsClient, type MeetingProblem } from "../meetingsClient";
import type { Meeting, MeetingFormValue, MeetingKindDto } from "../meetingTypes";
import { applyTimeGridLayout } from "../timeGridLayout";
import { businessHoursOf, scrollTimeOf, type WorkDay } from "../workWeek";
import { CalendarToolbar } from "./CalendarToolbar";
import { DayMeetingsDialog } from "./DayMeetingsDialog";
import { MeetingDetailsDialog } from "./MeetingDetailsDialog";
import { MeetingForm } from "./MeetingForm";
import { MeetingSidebar, useSidebarCollapsed } from "./MeetingSidebar";
import { useBreakpoint, useOrientation } from "@/shared/hooks/breakpoints";
import { readPhone } from "@/shared/hooks/usePhone";

const noSubscription = () => () => {};

// Options that never change, so FullCalendar is not handed new ones on every render.
const plugins = [timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin];
const weekHeader = { weekday: "short", day: "numeric", month: "numeric" } as const;
const views = {
  dayGridMonth: { dayHeaderFormat: { weekday: "short" } },
  timeGridWeek: { dayHeaderFormat: weekHeader },
  timeGridDay: { dayHeaderFormat: { weekday: "long", day: "numeric", month: "numeric" } },
} as const;
const hourMinute = { hour: "2-digit", minute: "2-digit", hour12: false } as const;
// Below this width (px) a desktop's toolbar row (period, adding, ranges, layouts, navigation) would wrap.
const narrowToolbarWidth = 920;
const shortDays = { "vi-VN": ["CN", "T2", "T3", "T4", "T5", "T6", "T7"], "en-US": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] } as const;

/** A flag read by one small component, so loading does not re-render the whole calendar. */
function createFlag() {
  let value = false;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: boolean) => { if (next !== value) { value = next; listeners.forEach(listener => listener()); } },
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
type Flag = ReturnType<typeof createFlag>;
type TimeChange = Parameters<ReturnType<typeof createTimeChangeHandler>>[0];

function CalendarStatus({ loading, busy }: { loading: Flag; busy: boolean }) {
  const { t } = useLocale();
  const isLoading = useSyncExternalStore(loading.subscribe, loading.get, () => false);
  if (!isLoading && !busy) return null;
  // Floats over the grid instead of taking a line above it: a reload on every search keystroke must not move the calendar.
  return <p role="status" className="meeting-calendar-status">{busy ? t("meetings.savingStatus") : t("meetings.loading")}</p>;
}

export function MeetingCalendar() {
  const { locale, t } = useLocale();
  const client = useMeetingsClient();
  const { user } = useCurrentUser();
  const userId = user?.id;
  const calendarRef = useRef<FullCalendar>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const layoutFrame = useRef<number | null>(null);
  // The screen's size and, on a phone, whether it is turned sideways (its view switch then sits in the toolbar).
  const size = useBreakpoint();
  const orientation = useOrientation();
  const isMobile = size === "phone";
  const landscape = isMobile && orientation === "landscape";
  // A desktop has a sidebar left of the calendar (a month, the meetings shown), which the viewer may fold away.
  const desktop = size === "desktop";
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const showSidebar = desktop && !sidebarCollapsed;
  const sidebarId = useId();
  // Beside the sidebar (or a wide app menu) the calendar can be too narrow for the desktop's one-row toolbar: it then
  // takes the tablet's two rows, the filters behind their icon.
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!desktop || !main) return;
    const measure = () => setNarrow(main.getBoundingClientRect().width < narrowToolbarWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    return () => observer.disconnect();
  }, [desktop]);
  // The calendar is drawn once mounted, in the view that suits the screen, so it loads one range once.
  const mounted = useSyncExternalStore(noSubscription, () => true, () => false);
  // The calendar the page URL names, read once: its view (else the one that suits the screen), the date shown and
  // the filters. What is shown is written back to the URL, so a reload or a shared link shows the same calendar.
  const searchParams = useSearchParams();
  const router = useRouter();
  // The view this screen opens on without one in the URL (fixed at mount), which the URL then leaves out.
  const [screenView] = useState(() => typeof window !== "undefined" && readPhone() ? "dayGridMonth" as const : defaultView);
  const [fromUrl] = useState(() => readCalendarState(searchParams, screenView));
  const initialView = fromUrl.view;
  const [view, setView] = useState<string>(initialView);
  const [filters, setFilters] = useState(fromUrl.filters);
  // The meetings and series the sidebar hides from a desktop's calendar (meetingList.ts keys), kept in the URL.
  const [hidden, setHidden] = useState(fromUrl.hidden);
  // The meetings of the range shown, as last read (hidden ones too), which the sidebar lists.
  const [rangeMeetings, setRangeMeetings] = useState<Meeting[]>([]);
  // The day the calendar is on (yyyy-mm-dd), which the sidebar's month shows filled.
  const [currentDate, setCurrentDate] = useState(() => fromUrl.date ?? calendarTime(new Date()).slice(0, 10));
  // The view and date on screen (date null: a range that includes today), as the URL keeps them.
  const [shown, setShown] = useState({ view: initialView, date: fromUrl.date });
  const [calendarTitle, setCalendarTitle] = useState("");
  // The period shown (its dates), which a phone names short.
  const [period, setPeriod] = useState<{ type: string; start: Date; end: Date } | null>(null);
  const [loading] = useState(createFlag);
  const [isUpdating, setUpdating] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const saveLock = useRef(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [moreGroup, setMoreGroup] = useState<MoreItems<Meeting> | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [initialForm, setInitialForm] = useState<MeetingFormValue | null>(null);
  const [formSession, setFormSession] = useState(0);
  const [error, setError] = useState<MeetingProblem | null>(null);
  const mutation = useRef<{ fingerprint: string; id: string } | null>(null);
  const [saveOccurrence] = useState(createOccurrenceSaver);
  const [now, setNow] = useState(() => calendarTime(new Date()));
  useEffect(() => {
    const timer = setInterval(() => setNow(calendarTime(new Date())), 60_000);
    return () => clearInterval(timer);
  }, []);
  const busy = isUpdating || isSaving;

  // The organization's work week, only for display (shading, where the grid opens); without it the calendar shows every hour.
  const [workWeek, setWorkWeek] = useState<WorkDay[] | null>(null);
  const businessHours = useMemo(() => workWeek ? businessHoursOf(workWeek) : false, [workWeek]);
  const scrollTime = useMemo(() => scrollTimeOf(workWeek ?? []), [workWeek]);
  useEffect(() => {
    const controller = new AbortController();
    client.workWeek(controller.signal).then(week => {
      setWorkWeek(week.days ?? null);
      if (week.days) calendarRef.current?.getApi().scrollToTime(scrollTimeOf(week.days));
    }, () => {});
    return () => controller.abort();
  }, [client]);

  // What callbacks handed to FullCalendar read, without becoming new callbacks (and new calendar options) each time.
  const live = useRef({ view: initialView as string, filters, hidden, desktop, reuseLoad: false, userId, isMobile, t, client, busy, loadFailed: false });
  useLayoutEffect(() => { Object.assign(live.current, { userId, isMobile, desktop, t, client, busy }); });

  // The catalog of kinds, hidden ones too (the form labels the hidden kind of an old meeting), once per language;
  // `kindsAttempt` asks for it again (after a failed read).
  const [kinds, setKinds] = useState<MeetingKindDto[]>([]);
  const [kindsAttempt, setKindsAttempt] = useState(0);
  const lastNotice = useRef<{ message: string; id: string } | null>(null);
  const notifyError = useCallback((message: string | null) => {
    if (!message || lastNotice.current?.message === message) return;
    const notice = toast.danger(message, {
      timeout: 8000,
      onClose: () => { if (lastNotice.current?.id === notice) lastNotice.current = null; },
      actionProps: { children: live.current.t("common.retry"), onPress: () => { toast.close(notice); calendarRef.current?.getApi().refetchEvents(); setKindsAttempt(attempt => attempt + 1); } },
    });
    lastNotice.current = { message, id: notice };
  }, []);

  const latestLoad = useRef<AbortController | null>(null);
  // The last meetings read and what for (range and filters): showing or hiding one in the sidebar draws them again
  // without asking the server.
  const lastLoad = useRef<{ key: string; meetings: Meeting[] } | null>(null);
  const loadEvents = useCallback(async (range: EventSourceFuncArg) => {
    latestLoad.current?.abort();
    const controller = new AbortController();
    latestLoad.current = controller;
    const { view: shownView, isMobile: phone, userId: viewer, t: translate, client: api } = live.current;
    const key = JSON.stringify([range.startStr, range.endStr, live.current.filters]);
    const reuse = live.current.reuseLoad && lastLoad.current?.key === key;
    live.current.reuseLoad = false;
    try {
      const meetings = reuse ? lastLoad.current!.meetings : await api.meetings(toMeetingQuery(live.current.filters, serverTime(range.start), serverTime(range.end)), controller.signal);
      lastLoad.current = { key, meetings };
      setRangeMeetings(meetings);
      live.current.loadFailed = false;
      lastNotice.current = null;
      // Only a desktop hides meetings (its sidebar shows them again); a smaller screen, without it, shows them all.
      const shownMeetings = live.current.desktop ? visibleMeetings(meetings, live.current.hidden) : meetings;
      return calendarInputs(shownMeetings, shownView, phone, viewer, count => translate("meetings.moreCount").replace("{count}", String(count)));
    } catch (failure) {
      const problem = meetingProblem(failure);
      // A session that ended (401) goes back to the sign-in page; nothing to report here.
      if (!controller.signal.aborted && problem.status !== 401) {
        live.current.loadFailed = true;
        notifyError(problem.detail ?? translate("meetings.loadFailed"));
      }
      throw failure;
    }
  }, [notifyError]);
  useEffect(() => () => latestLoad.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();
    client.kinds(true, controller.signal).then(setKinds, failure => {
      const problem = meetingProblem(failure);
      if (!controller.signal.aborted && problem.status !== 401) notifyError(problem.detail ?? live.current.t("meetings.loadFailed"));
    });
    return () => controller.abort();
  }, [client, locale, notifyError, kindsAttempt]);

  // Who may move what depends on who is signed in.
  const shownFor = useRef(userId);
  useEffect(() => {
    if (shownFor.current === userId) return;
    shownFor.current = userId;
    calendarRef.current?.getApi().refetchEvents();
  }, [userId]);

  // A new screen size or orientation (a phone turned) lays the calendar out again and asks for its meetings again:
  // what a day or a time slot holds, the dots and what can be moved depend on the screen.
  const screenKey = mounted ? `${size}/${orientation}` : null;
  const drawnFor = useRef(screenKey);
  useEffect(() => {
    if (!screenKey) return;
    if (drawnFor.current && drawnFor.current !== screenKey) calendarRef.current?.getApi().refetchEvents();
    drawnFor.current = screenKey;
  }, [screenKey]);

  const arrangeTimeGrid = useCallback(() => {
    const api = calendarRef.current?.getApi();
    if (api?.view.type.startsWith("timeGrid") && gridRef.current) applyTimeGridLayout(gridRef.current, api.getEvents(), live.current.t("meetings.allDay"));
  }, []);
  const queueLayout = useCallback(() => {
    if (layoutFrame.current !== null) cancelAnimationFrame(layoutFrame.current);
    layoutFrame.current = requestAnimationFrame(arrangeTimeGrid);
  }, [arrangeTimeGrid]);
  useEffect(() => () => { if (layoutFrame.current !== null) cancelAnimationFrame(layoutFrame.current); }, []);

  const handleDatesSet = useCallback((range: DatesSetArg) => {
    live.current.view = range.view.type;
    setView(range.view.type);
    setCalendarTitle(range.view.title);
    setCurrentDate(range.view.calendar.getDate().toISOString().slice(0, 10));
    const today = new Date(calendarTime(new Date()));
    const showsToday = range.view.currentStart <= today && today < range.view.currentEnd;
    setShown({ view: isCalendarView(range.view.type) ? range.view.type : defaultView, date: showsToday ? null : range.view.calendar.getDate().toISOString().slice(0, 10) });
    setPeriod({ type: range.view.type, start: range.view.currentStart, end: range.view.currentEnd });
  }, []);
  const changeFilters = (next: MeetingFilters) => {
    // Set first: the meetings are asked for again at once, with these filters.
    live.current.filters = next;
    setFilters(next);
    calendarRef.current?.getApi().refetchEvents();
  };
  // Shows or hides meetings in the calendar from the meetings already read.
  const changeHidden = (next: string[]) => {
    live.current.hidden = next;
    live.current.reuseLoad = true;
    setHidden(next);
    calendarRef.current?.getApi().refetchEvents();
  };
  const goToDate = (date: string) => {
    setCurrentDate(date);
    calendarRef.current?.getApi().gotoDate(date);
  };
  const written = useRef(writeCalendarState(fromUrl, screenView).toString());
  useEffect(() => {
    const query = writeCalendarState({ ...shown, filters, hidden }, screenView).toString();
    if (query === written.current) return;
    written.current = query;
    router.replace(query ? `/meetings?${query}` : "/meetings", { scroll: false });
  }, [shown, filters, hidden, router, screenView]);
  // The grid is as wide as the sidebar leaves it: FullCalendar measures again when it opens or closes.
  const sizedFor = useRef(showSidebar);
  useEffect(() => {
    if (sizedFor.current === showSidebar) return;
    sizedFor.current = showSidebar;
    calendarRef.current?.getApi().updateSize();
    queueLayout();
  }, [showSidebar, queueLayout]);
  const changeView = (next: string) => {
    // Set first: FullCalendar asks for the new range's events while changing view.
    live.current.view = next;
    setView(next);
    calendarRef.current?.getApi().changeView(next);
  };

  // One handler for every drag and resize (it saves one at a time), made at the first one.
  const timeChange = useRef<ReturnType<typeof createTimeChangeHandler> | null>(null);
  const changeTime = useCallback((change: TimeChange, operation: "drop" | "resize") => {
    timeChange.current ??= createTimeChangeHandler({
      save: event => saveOccurrence(event, live.current.client),
      onPending: setUpdating,
      onError: message => notifyError(message),
      onSaved: () => {},
      onSettled: () => calendarRef.current?.getApi().refetchEvents(),
      get messages() {
        const translate = live.current.t;
        return { busy: translate("meetings.savingWait"), notAllowed: translate("meetings.moveNotAllowed"), failed: translate("meetings.updateFailed") };
      },
    });
    void timeChange.current(change, live.current.userId, operation);
  }, [saveOccurrence, notifyError]);

  const eventAllow = useCallback((range: { start: Date; end: Date; allDay: boolean }, event: EventApi | null) => {
    if (!event || event.extendedProps.more) return false;
    const { busy: saving, loadFailed, view: shownView, userId: viewer } = live.current;
    const operation = shownView.startsWith("timeGrid") && event.extendedProps.isAllDay ? "resize" : "drop";
    return canMoveMeeting({ id: event.id, start: range.start, end: range.end, allDay: range.allDay, extendedProps: event.extendedProps }, viewer, saving || loadFailed, operation);
  }, []);
  const eventDrop = useCallback((change: TimeChange) => changeTime(change, "drop"), [changeTime]);
  const eventResize = useCallback((change: TimeChange) => changeTime(change, "resize"), [changeTime]);
  // A phone's month shows dots: a tap on a day (its dots too) lists the day's meetings, as "+N" does.
  const openDay = useCallback((day: string) => {
    const meetings = (calendarRef.current?.getApi().getEvents() ?? []).flatMap(event => (event.extendedProps as Partial<MoreProps>).more?.items ?? [event.extendedProps as Meeting]);
    const group = meetingsOfDay(meetings, day);
    if (group) setMoreGroup(group);
  }, []);
  const eventClick = useCallback(({ event, jsEvent }: EventClickArg) => {
    jsEvent.preventDefault();
    if (live.current.busy) return;
    const more = (event.extendedProps as Partial<MoreProps>).more;
    if (showsDots(live.current.view, live.current.isMobile)) openDay((jsEvent.target as Element).closest<HTMLElement>("[data-date]")?.dataset.date ?? more?.day ?? event.startStr.slice(0, 10));
    else if (more) setMoreGroup(more);
    else setSelectedMeeting(event.extendedProps as Meeting);
  }, [openDay]);
  const dateClick = useCallback(({ dateStr, view: shownView }: DateClickArg) => {
    if (!live.current.busy && showsDots(shownView.type, live.current.isMobile)) openDay(dateStr.slice(0, 10));
  }, [openDay]);
  const eventDidMount = useCallback((arg: EventMountArg) => {
    arg.el.dataset.meetingId = arg.event.id;
    if (!arg.event.extendedProps.more) {
      // The meeting's own colour: its stripe, tint and dot (globals.css --meeting-color).
      const color = (arg.event.extendedProps as Partial<Meeting>).color;
      if (color) arg.el.style.setProperty("--meeting-color", color);
      const time = arg.event.extendedProps.isAllDay ? live.current.t("meetings.allDay") : `${arg.event.start?.toISOString().slice(11, 16)}–${arg.event.end?.toISOString().slice(11, 16)}`;
      arg.el.title = `${arg.event.title}\n${time}`;
      arg.el.setAttribute("aria-label", `${arg.event.title}, ${time}`);
    } else arg.el.setAttribute("aria-label", arg.event.title);
    queueLayout();
  }, [queueLayout]);
  const eventContent = useCallback((arg: EventContentArg) => {
    if (arg.isResizing && arg.event.start && arg.event.end) {
      const format = (date: Date) => date.toLocaleString(locale, { timeZone: "UTC", day: "2-digit", month: "2-digit", ...hourMinute });
      return <div className="meeting-resize-preview sticky top-0 px-1 py-1 text-xs"><div className="font-medium">{format(arg.event.start)} → {format(arg.event.end)}</div><div>{arg.event.title}</div></div>;
    }
    // On a phone a month day shows dots and "+N"; a week's narrow cards show the title alone.
    const more = (arg.event.extendedProps as Partial<MoreProps>).more;
    if (showsDots(arg.view.type, isMobile)) return more ? <span className="meeting-more-count">+{more.items.length}</span> : <span className="meeting-dot" />;
    if (isMobile && !landscape && arg.view.type === "timeGridWeek") return <div className="meeting-compact-title">{more ? `+${more.items.length}` : (arg.event.extendedProps as Meeting).title}</div>;
    return arg.event.extendedProps.isAllDay && arg.view.type.startsWith("timeGrid")
      ? <div className="sticky top-0 px-1 py-1 text-xs"><div className="font-medium">{t("meetings.allDay")}</div><div>{arg.event.title}</div></div>
      : true;
  }, [isMobile, landscape, locale, t]);
  const dayHeaderContent = useCallback((arg: DayHeaderContentArg) => (
    <span className="meeting-day-heading">
      <span>{isMobile ? (shortDays[locale as keyof typeof shortDays] ?? shortDays["en-US"])[arg.date.getUTCDay()] : arg.date.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" })}</span>
      {arg.view.type !== "dayGridMonth" && <span className={arg.isToday ? "meeting-today-badge" : "meeting-day-number"}>{arg.date.getUTCDate()}</span>}
    </span>
  ), [isMobile, locale]);
  const buttonText = useMemo(() => ({ today: t("meetings.today"), month: t("meetings.month"), week: t("meetings.week"), day: t("meetings.day"), list: t("meetings.list") }), [t]);

  const openCreate = () => {
    if (!kinds.length) setKindsAttempt(attempt => attempt + 1);
    setError(null);
    setEditingMeeting(null);
    setInitialForm(newMeetingForm(kinds.find(kind => kind.isActive)?.id ?? null));
    setFormSession(session => session + 1);
    mutation.current = null;
    setFormOpen(true);
  };
  const openEdit = async (meeting: Meeting) => {
    setOpeningId(meeting.id);
    try {
      const audience = await client.audience(meeting.id);
      setError(null);
      setEditingMeeting(meeting);
      setInitialForm(fromMeeting(meeting, audience));
      setFormSession(session => session + 1);
      mutation.current = null;
      setSelectedMeeting(null);
      setFormOpen(true);
    } catch (failure) {
      notifyError(meetingProblem(failure).detail ?? t("meetings.loadFailed"));
    } finally {
      setOpeningId(null);
    }
  };

  async function saveMeeting(value: MeetingFormValue) {
    if (saveLock.current || isUpdating) return;
    setError(null);
    if (editingMeeting && editingMeeting.organizerId !== userId) {
      setError({ status: 403, code: "forbidden", detail: t("meetings.organizerEditOnly") });
      return;
    }
    saveLock.current = true;
    setSaving(true);
    try {
      const details = toMeetingWriteRequest(value, "");
      const edit = editingMeeting ? { details, scope: editScopeOf(value), expectedVersion: editingMeeting.version, expectedSeriesVersion: editingMeeting.seriesVersion ?? null, replaceExceptions: value.replaceExceptions } : null;
      mutation.current = mutationKey(mutation.current, edit ?? details);
      details.mutationId = mutation.current.id;
      if (editingMeeting && edit) await client.update(editingMeeting.id, edit);
      else await client.create(details);
      setFormOpen(false);
      setEditingMeeting(null);
      setInitialForm(null);
      mutation.current = null;
      calendarRef.current?.getApi().refetchEvents();
    } catch (failure) {
      const problem = meetingProblem(failure);
      if ([400, 403, 409, 422].includes(problem.status)) setError(problem);
      else if (problem.status !== 401) notifyError(problem.detail ?? t("meetings.saveFailed"));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  // The range (day, week, month) and the layout (grid or list) are chosen apart; each keeps the other.
  const range = rangeOf(view);
  const layout = layoutOf(view);
  // Phone styles for the month's dots and the week that fits the screen (globals.css).
  const gridClass = showsDots(view, isMobile) ? "meeting-grid-scroll--dots" : view === "timeGridWeek" ? "meeting-grid-scroll--week" : "";
  return (
    <div className="meeting-calendar-page flex flex-col gap-4">
      <div className={`meeting-calendar rounded-2xl border border-separator bg-surface p-4 shadow-sm ${isMobile && !landscape ? "meeting-calendar--floating-switch" : ""}`}>
        <div className="meeting-calendar-columns">
        {showSidebar && (
          <MeetingSidebar id={sidebarId} date={currentDate} meetings={rangeMeetings} filters={filters} hidden={hidden} busy={busy}
            onPick={goToDate} onHidden={changeHidden} />
        )}
        <div ref={mainRef} className="meeting-calendar-main">
        <CalendarToolbar size={size} landscape={landscape} narrow={desktop && narrow} busy={busy} filters={filters} kinds={kinds} range={range} layout={layout}
          title={calendarTitle} shortTitle={period ? compactTitle(period.type, period.start, period.end, locale, t("meetings.monthTitle")) : ""}
          sidebar={desktop ? { open: showSidebar, controls: sidebarId, onToggle: () => setSidebarCollapsed(showSidebar) } : undefined}
          onRange={next => changeView(viewOf(next, layout))} onLayout={next => changeView(viewOf(range, next))} onFilters={changeFilters}
          onPrevious={() => calendarRef.current?.getApi().prev()} onNext={() => calendarRef.current?.getApi().next()}
          onToday={() => calendarRef.current?.getApi().today()} onAdd={openCreate} />
        <div className="meeting-calendar-body relative">
        <CalendarStatus loading={loading} busy={busy} />
        <div ref={gridRef} aria-busy={busy} className={`meeting-grid-scroll ${gridClass}`}>
          {mounted && (
            <FullCalendar
              ref={calendarRef}
              plugins={plugins}
              initialView={initialView}
              initialDate={fromUrl.date ?? undefined}
              locale={locale === "vi-VN" ? viLocale : undefined}
              timeZone="UTC"
              now={now}
              firstDay={1}
              weekends
              weekNumbers={false}
              weekText={t("meetings.week")}
              allDaySlot={false}
              allDayText={t("meetings.allDay")}
              nowIndicator
              selectable={false}
              editable={!busy}
              eventResizableFromStart
              eventStartEditable={!busy}
              eventDurationEditable={!busy}
              slotEventOverlap
              lazyFetching={false}
              eventsSet={queueLayout}
              eventDidMount={eventDidMount}
              eventDisplay={showsDots(view, isMobile) ? "block" : "auto"}
              displayEventTime={!showsDots(view, isMobile)}
              eventContent={eventContent}
              eventAllow={eventAllow}
              eventDrop={eventDrop}
              eventResize={eventResize}
              eventClick={eventClick}
              dateClick={dateClick}
              slotDuration="00:30:00"
              slotLabelInterval="01:00:00"
              snapDuration="00:15:00"
              slotLabelFormat={hourMinute}
              eventTimeFormat={hourMinute}
              dayHeaderContent={dayHeaderContent}
              views={views}
              businessHours={businessHours}
              scrollTime={scrollTime}
              slotMinTime="00:00:00"
              slotMaxTime="24:00:00"
              dragScroll
              // A phone's calendar fills the screen below its toolbar (globals.css); the time grids scroll inside it.
              height="100%"
              expandRows
              dayMaxEvents={false}
              events={loadEvents}
              datesSet={handleDatesSet}
              loading={loading.set}
              headerToolbar={false}
              buttonText={buttonText}
            />
          )}
        </div>
        </div>
        </div>
        </div>
      </div>
      <Modal.Backdrop isOpen={isFormOpen} onOpenChange={open => { if (!saveLock.current) setFormOpen(open); }} isDismissable={!isSaving} isKeyboardDismissDisabled={isSaving}>
        <Modal.Container size="full" placement="center" scroll="inside">
          <Modal.Dialog className="meeting-booking-dialog">
            {!isSaving && <Modal.CloseTrigger aria-label={t("meetings.close")} />}
            <Modal.Header><Modal.Heading>{editingMeeting ? t("meetings.edit") : t("meetings.add")}</Modal.Heading></Modal.Header>
            {initialForm && (
              <MeetingForm key={formSession} initial={initialForm} kinds={kinds} isSaving={isSaving} onSubmit={value => void saveMeeting(value)} onCancel={() => setFormOpen(false)} problem={error}
                onReload={() => { setFormOpen(false); calendarRef.current?.getApi().refetchEvents(); }} />
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <MeetingDetailsDialog meeting={selectedMeeting} userId={userId} busy={busy || openingId !== null}
        onClose={() => setSelectedMeeting(null)} onEdit={meeting => void openEdit(meeting)}
        onCanceled={() => { setSelectedMeeting(null); calendarRef.current?.getApi().refetchEvents(); }} />
      <DayMeetingsDialog group={moreGroup} onClose={() => setMoreGroup(null)} onOpen={meeting => { setMoreGroup(null); setSelectedMeeting(meeting); }} />
    </div>
  );
}
