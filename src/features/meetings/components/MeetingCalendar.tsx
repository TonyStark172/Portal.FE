"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button, Modal, Tabs, toast } from "@heroui/react";
import { ChevronLeft, ChevronRight, Plus } from "@gravity-ui/icons";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import viLocale from "@fullcalendar/core/locales/vi";
import type { DatesSetArg, EventApi, EventClickArg, EventContentArg, EventMountArg, EventSourceFuncArg, DayHeaderContentArg } from "@fullcalendar/core";
import { useCurrentUser } from "@/features/auth";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { canMoveMeeting, createOccurrenceSaver, createTimeChangeHandler } from "../calendarEvents";
import { calendarInputs, calendarTime, serverTime, type MoreProps } from "../calendarInputs";
import type { MoreItems } from "../calendarCapacity";
import { editScopeOf, fromMeeting, newMeetingForm, toMeetingWriteRequest } from "../meetingForm";
import { meetingProblem, mutationKey, useMeetingsClient, type MeetingProblem } from "../meetingsClient";
import type { Meeting, MeetingFormValue } from "../meetingTypes";
import { applyTimeGridLayout } from "../timeGridLayout";
import { DayMeetingsDialog } from "./DayMeetingsDialog";
import { MeetingDetailsDialog } from "./MeetingDetailsDialog";
import { MeetingForm } from "./MeetingForm";

const mobileQuery = "(max-width: 767px)";
const readMobile = () => window.matchMedia(mobileQuery).matches;
const subscribeMobile = (notify: () => void) => {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const noSubscription = () => () => {};

// Options that never change, so FullCalendar is not handed new ones on every render.
const plugins = [timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin];
const views = {
  dayGridMonth: { dayHeaderFormat: { weekday: "short" } },
  timeGridWeek: { dayHeaderFormat: { weekday: "short", day: "numeric", month: "numeric" } },
  timeGridDay: { dayHeaderFormat: { weekday: "long", day: "numeric", month: "numeric" } },
} as const;
const hourMinute = { hour: "2-digit", minute: "2-digit", hour12: false } as const;
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
  return <p role="status" className="mb-3 text-sm text-muted">{busy ? t("meetings.savingStatus") : t("meetings.loading")}</p>;
}

export function MeetingCalendar() {
  const { locale, t } = useLocale();
  const client = useMeetingsClient();
  const { user } = useCurrentUser();
  const userId = user?.id;
  const calendarRef = useRef<FullCalendar>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const layoutFrame = useRef<number | null>(null);
  const isMobile = useSyncExternalStore(subscribeMobile, readMobile, () => false);
  // The calendar is drawn once mounted, in the view that suits the screen, so it loads one range once.
  const mounted = useSyncExternalStore(noSubscription, () => true, () => false);
  const [initialView] = useState(() => typeof window !== "undefined" && readMobile() ? "dayGridMonth" : "timeGridWeek");
  const [view, setView] = useState(initialView);
  const [calendarTitle, setCalendarTitle] = useState("");
  const [compactTitle, setCompactTitle] = useState("");
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

  // What callbacks handed to FullCalendar read, without becoming new callbacks (and new calendar options) each time.
  const live = useRef({ view: initialView, userId, isMobile, t, client, busy, loadFailed: false });
  useLayoutEffect(() => { Object.assign(live.current, { userId, isMobile, t, client, busy }); });

  const lastNotice = useRef<{ message: string; id: string } | null>(null);
  const notifyError = useCallback((message: string | null) => {
    if (!message || lastNotice.current?.message === message) return;
    const notice = toast.danger(message, {
      timeout: 8000,
      onClose: () => { if (lastNotice.current?.id === notice) lastNotice.current = null; },
      actionProps: { children: live.current.t("common.retry"), onPress: () => { toast.close(notice); calendarRef.current?.getApi().refetchEvents(); } },
    });
    lastNotice.current = { message, id: notice };
  }, []);

  const latestLoad = useRef<AbortController | null>(null);
  const loadEvents = useCallback(async (range: EventSourceFuncArg) => {
    latestLoad.current?.abort();
    const controller = new AbortController();
    latestLoad.current = controller;
    const { view: shownView, isMobile: phone, userId: viewer, t: translate, client: api } = live.current;
    try {
      const meetings = await api.meetings(serverTime(range.start), serverTime(range.end), controller.signal);
      live.current.loadFailed = false;
      lastNotice.current = null;
      return calendarInputs(meetings, shownView, phone, viewer, count => translate("meetings.moreCount").replace("{count}", String(count)));
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

  // Who may move what depends on who is signed in.
  const shownFor = useRef(userId);
  useEffect(() => {
    if (shownFor.current === userId) return;
    shownFor.current = userId;
    calendarRef.current?.getApi().refetchEvents();
  }, [userId]);

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
    setCompactTitle(range.view.type === "dayGridMonth"
      ? live.current.t("meetings.monthTitle").replace("{month}", String(range.view.currentStart.getUTCMonth() + 1)).replace("{year}", String(range.view.currentStart.getUTCFullYear()))
      : range.view.title);
  }, []);
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
  const eventClick = useCallback(({ event, jsEvent }: EventClickArg) => {
    jsEvent.preventDefault();
    if (live.current.busy) return;
    const more = (event.extendedProps as Partial<MoreProps>).more;
    if (more) setMoreGroup(more);
    else setSelectedMeeting(event.extendedProps as Meeting);
  }, []);
  const eventDidMount = useCallback((arg: EventMountArg) => {
    arg.el.dataset.meetingId = arg.event.id;
    if (!arg.event.extendedProps.more) {
      const time = arg.event.extendedProps.isAllDay ? live.current.t("meetings.allDay") : `${arg.event.start?.toISOString().slice(11, 16)}–${arg.event.end?.toISOString().slice(11, 16)}`;
      arg.el.title = `${arg.event.title}\n${time}`;
      arg.el.setAttribute("aria-label", `${arg.event.title}, ${time}`);
    }
    queueLayout();
  }, [queueLayout]);
  const eventContent = useCallback((arg: EventContentArg) => {
    if (arg.isResizing && arg.event.start && arg.event.end) {
      const format = (date: Date) => date.toLocaleString(locale, { timeZone: "UTC", day: "2-digit", month: "2-digit", ...hourMinute });
      return <div className="meeting-resize-preview sticky top-0 px-1 py-1 text-xs"><div className="font-medium">{format(arg.event.start)} → {format(arg.event.end)}</div><div>{arg.event.title}</div></div>;
    }
    return arg.event.extendedProps.isAllDay && arg.view.type.startsWith("timeGrid")
      ? <div className="sticky top-0 px-1 py-1 text-xs"><div className="font-medium">{t("meetings.allDay")}</div><div>{arg.event.title}</div></div>
      : true;
  }, [locale, t]);
  const dayHeaderContent = useCallback((arg: DayHeaderContentArg) => (
    <span className="meeting-day-heading">
      <span>{isMobile ? (shortDays[locale as keyof typeof shortDays] ?? shortDays["en-US"])[arg.date.getUTCDay()] : arg.date.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" })}</span>
      {arg.view.type !== "dayGridMonth" && <span className={arg.isToday ? "meeting-today-badge" : "meeting-day-number"}>{arg.date.getUTCDate()}</span>}
    </span>
  ), [isMobile, locale]);
  const buttonText = useMemo(() => ({ today: t("meetings.today"), month: t("meetings.month"), week: t("meetings.week"), day: t("meetings.day"), list: t("meetings.list") }), [t]);

  const openCreate = () => {
    setError(null);
    setEditingMeeting(null);
    setInitialForm(newMeetingForm(t("meetings.defaultKind")));
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

  const tabs = [["timeGridDay", t("meetings.day")], ["timeGridWeek", t("meetings.week")], ["dayGridMonth", t("meetings.month")], ["listWeek", t("meetings.list")]] as const;
  return (
    <div className="flex flex-col gap-4">
      <div className="meeting-calendar rounded-2xl border border-separator bg-surface p-4 shadow-sm">
        <div className="meeting-toolbar mb-5 flex flex-wrap items-center gap-3">
          <h2 aria-live="polite" className="mr-auto text-xl font-semibold tracking-tight">{isMobile ? compactTitle : calendarTitle}</h2>
          <div className="meeting-add flex flex-wrap items-center gap-2">
            <Button size="sm" isIconOnly={isMobile} aria-label={t("meetings.add")} isDisabled={busy} onPress={openCreate}>
              <Plus className="size-4" />{!isMobile && t("meetings.add")}
            </Button>
          </div>
          <Tabs className="w-fit max-w-full shrink-0" selectedKey={view} onSelectionChange={key => changeView(String(key))}>
            <Tabs.ListContainer>
              <Tabs.List aria-label={t("meetings.calendarView")}>
                {tabs.map(([id, label]) => <Tabs.Tab isDisabled={busy} className="w-auto shrink-0 whitespace-nowrap" key={id} id={id}>{label}<Tabs.Indicator /></Tabs.Tab>)}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          <div className="meeting-navigation flex items-center gap-1">
            <Button size="sm" variant="ghost" isIconOnly isDisabled={busy} aria-label={t("meetings.previous")} onPress={() => calendarRef.current?.getApi().prev()}><ChevronLeft className="size-4" /></Button>
            <Button size="sm" variant="outline" isDisabled={busy} onPress={() => calendarRef.current?.getApi().today()}>{t("meetings.today")}</Button>
            <Button size="sm" variant="ghost" isIconOnly isDisabled={busy} aria-label={t("meetings.next")} onPress={() => calendarRef.current?.getApi().next()}><ChevronRight className="size-4" /></Button>
          </div>
        </div>
        <CalendarStatus loading={loading} busy={busy} />
        <div ref={gridRef} aria-busy={busy} className={`meeting-grid-scroll ${view === "timeGridWeek" ? "meeting-grid-scroll--week" : ""}`}>
          {mounted && (
            <FullCalendar
              ref={calendarRef}
              plugins={plugins}
              initialView={initialView}
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
              eventDisplay={isMobile && view === "dayGridMonth" ? "block" : "auto"}
              displayEventTime={!(isMobile && view === "dayGridMonth")}
              eventContent={eventContent}
              eventAllow={eventAllow}
              eventDrop={eventDrop}
              eventResize={eventResize}
              eventClick={eventClick}
              slotDuration="00:30:00"
              slotLabelInterval="01:00:00"
              snapDuration="00:15:00"
              slotLabelFormat={hourMinute}
              eventTimeFormat={hourMinute}
              dayHeaderContent={dayHeaderContent}
              views={views}
              scrollTime="08:00:00"
              slotMinTime="00:00:00"
              slotMaxTime="24:00:00"
              dragScroll
              height={isMobile ? (view === "dayGridMonth" ? "auto" : 600) : "min(760px, calc(100dvh - 220px))"}
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
      <Modal.Backdrop isOpen={isFormOpen} onOpenChange={open => { if (!saveLock.current) setFormOpen(open); }} isDismissable={!isSaving} isKeyboardDismissDisabled={isSaving}>
        <Modal.Container size="full" placement="center" scroll="inside">
          <Modal.Dialog className="meeting-booking-dialog">
            {!isSaving && <Modal.CloseTrigger aria-label={t("meetings.close")} />}
            <Modal.Header><Modal.Heading>{editingMeeting ? t("meetings.edit") : t("meetings.add")}</Modal.Heading></Modal.Header>
            {initialForm && (
              <MeetingForm key={formSession} initial={initialForm} isSaving={isSaving} onSubmit={value => void saveMeeting(value)} onCancel={() => setFormOpen(false)} problem={error}
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
