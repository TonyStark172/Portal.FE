"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button, Modal, Tabs } from "@heroui/react";
import { ChevronLeft, ChevronRight, Plus } from "@gravity-ui/icons";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import viLocale from "@fullcalendar/core/locales/vi";
import type { EventSourceFuncArg, DatesSetArg } from "@fullcalendar/core";
import { useSelector } from "react-redux";
import { selectAccessToken } from "@/shared/session/sessionSlice";
import { useCurrentUser } from "@/features/auth";
import { canMoveMeeting, canMovePreview, createTimeChangeHandler, meetingRequest } from "../calendarEvents";
import { ParticipantNames } from "./ParticipantPicker";
import { MeetingForm } from "./MeetingForm";
import { addDateDays, businessInput, BUSINESS_OFFSET_MS, fromMeeting, newMeetingForm, toMeetingWriteRequest } from "../meetingForm";
import { createBooking, updateBooking, createOccurrenceSaver, meetingProblem, mutationKey, type MeetingProblem } from "../meetingApi";
import type { Meeting, MeetingFormValue } from "../meetingTypes";
import { applyTimeGridLayout } from "../timeGridLayout";

const subscribePreview = (notify: () => void) => {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
};
const readPreview = () => new URLSearchParams(window.location.search).get("previewAllDay") === "1";
const readOverlapPreview = () => new URLSearchParams(window.location.search).get("previewOverlap") === "20";
const mobileQuery = "(max-width: 767px)";
const readMobile = () => window.matchMedia(mobileQuery).matches;
const subscribeMobile = (notify: () => void) => {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

// FullCalendar's UTC grid represents business wall-clock dates. Only this adapter shifts instants.
const calendarTime = (instant: string | Date) => new Date(new Date(instant).getTime() + BUSINESS_OFFSET_MS).toISOString();
const serverTime = (wallDate: Date) => new Date(wallDate.getTime() - BUSINESS_OFFSET_MS).toISOString();

export function MeetingCalendar() {
  const calendarRef = useRef<FullCalendar>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const layoutFrame = useRef<number | null>(null);
  const [calendarTitle, setCalendarTitle] = useState("");
  const [compactTitle, setCompactTitle] = useState("");
  const isMobile = useSyncExternalStore(subscribeMobile, readMobile, () => false);
  const [view, setView] = useState("timeGridWeek");
  useEffect(() => {
    // Choose the mobile default only when opening, not whenever the viewport changes.
    if (readMobile()) calendarRef.current?.getApi().changeView("dayGridMonth");
  }, []);
  const urlPreview = useSyncExternalStore(subscribePreview, readPreview, () => false);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const previewAllDay = urlPreview && !previewDismissed;
  const urlOverlapPreview = useSyncExternalStore(subscribePreview, readOverlapPreview, () => false);
  const [overlapDismissed, setOverlapDismissed] = useState(false);
  const previewOverlap = urlOverlapPreview && !overlapDismissed;
  const token = useSelector(selectAccessToken);
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);
  const { user } = useCurrentUser();
  const userId = user?.id;
  const [isLoading, setLoading] = useState(false);
  const [isUpdating, setUpdating] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isCreating, setCreating] = useState(false);
  const createLock = useRef(false);
  const requestId = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [initialForm, setInitialForm] = useState<MeetingFormValue | null>(null);
  const [formSession, setFormSession] = useState(0);
  const [error, setError] = useState<MeetingProblem | null>(null);
  const mutation = useRef<{fingerprint:string;id:string}|null>(null);
  const [saveOccurrence]=useState(()=>createOccurrenceSaver());

  const load = useCallback(async (range: EventSourceFuncArg) => {
    const id = ++requestId.current;
    setLoadError(null);
    try {
      const meetings = await meetingRequest<Meeting[]>(`/api/Meetings?FromUtc=${encodeURIComponent(serverTime(range.start))}&ToUtc=${encodeURIComponent(serverTime(range.end))}`, tokenRef.current);
      const timedGrid = view.startsWith("timeGrid");
      const events = meetings.map((meeting) => ({
        id: String(meeting.id), title: `${meeting.title} · ${meeting.location}`,
        start: calendarTime(meeting.startUtc), end: calendarTime(meeting.endUtc), allDay: !!meeting.isAllDay && !timedGrid,
        editable: userId !== undefined && meeting.organizerId === userId,
        startEditable: userId !== undefined && meeting.organizerId === userId && !(timedGrid && meeting.isAllDay),
        classNames: [`meeting-tone-${meeting.id % 4}`],
        extendedProps: { ...meeting },
      }));
      if (previewOverlap) {
        const start = new Date(range.start);
        if (view === "timeGridWeek") start.setUTCDate(start.getUTCDate()+2);
        start.setUTCHours(10,0,0,0);
        const end = new Date(start); end.setUTCHours(12);
        return [...events,...Array.from({length:20},(_,index)=>({
          id:`preview-overlap-${index+1}`,title:`[Mẫu ${index+1}] Họp phòng ${701+index}`,
          start:start.toISOString(),end:end.toISOString(),allDay:false,editable:true,
          classNames:[`meeting-tone-${index%4}`],
          extendedProps:{preview:true,previewInteractive:true,title:`[Mẫu ${index+1}] Họp`,location:String(701+index)},
        }))];
      }
      if (!previewAllDay) return events;
      const first = new Date(range.start); first.setUTCDate(first.getUTCDate() + 2);
      const second = new Date(first); second.setUTCDate(second.getUTCDate() + 1);
      const last = new Date(first); last.setUTCDate(last.getUTCDate() + 3);
      const day = (date: Date) => date.toISOString().slice(0, 10);
      return [...events,
        { id: "preview-holiday", title: "[Mẫu] Ngày nghỉ công ty", start: day(first), end: day(second), allDay: !timedGrid, editable: false, classNames: ["meeting-tone-1"], extendedProps: { preview: true, isAllDay: true } },
        { id: "preview-trip", title: "[Mẫu] Đi công tác · 3 ngày", start: day(first), end: day(last), allDay: !timedGrid, editable: false, classNames: ["meeting-tone-0"], extendedProps: { preview: true, isAllDay: true } },
      ];
    } catch (error) {
      if (id === requestId.current) setLoadError(error instanceof Error ? error.message : "Không thể tải lịch họp.");
      throw error;
    }
  }, [userId, previewAllDay, previewOverlap, view]);
  const arrangeTimeGrid = useCallback(() => {
    const api = calendarRef.current?.getApi();
    if (!api || !api.view.type.startsWith("timeGrid")) return;
    if (gridRef.current) applyTimeGridLayout(gridRef.current, api.getEvents());
  }, []);
  const queueLayout = useCallback(() => {
    if (layoutFrame.current !== null) cancelAnimationFrame(layoutFrame.current);
    layoutFrame.current = requestAnimationFrame(arrangeTimeGrid);
  }, [arrangeTimeGrid]);
  useEffect(()=>()=>{if(layoutFrame.current!==null) cancelAnimationFrame(layoutFrame.current);},[]);
  const handleDatesSet = useCallback((range: DatesSetArg) => {
    setCalendarTitle(range.view.title);
    setCompactTitle(range.view.type === "dayGridMonth"
      ? `Tháng ${range.view.currentStart.getUTCMonth() + 1}, ${range.view.currentStart.getUTCFullYear()}`
      : range.view.title);
    setView(range.view.type);
  }, [setCalendarTitle, setView]);
  const refetchEvents = useCallback(() => calendarRef.current?.getApi().refetchEvents(), []);
  useEffect(() => { if (refreshVersion > 0) refetchEvents(); }, [refreshVersion, refetchEvents]);
  const handleTimeChange = useMemo(() => createTimeChangeHandler({
    save:event=>saveOccurrence(event,token),
    onPending: setUpdating,
    onError: setUpdateError,
    onSaved: () => {},
    onSettled: () => setRefreshVersion((version) => version + 1),
  }), [saveOccurrence,token]);
  const busy = isUpdating || isCreating;

  async function saveMeeting(value: MeetingFormValue) {
    if (createLock.current || isUpdating) return;
    setError(null);
    if (editingMeeting && editingMeeting.organizerId !== userId) {
      setError({status:403,code:"forbidden",detail:"Chỉ người tổ chức được chỉnh sửa cuộc họp."});
      return;
    }
    createLock.current = true;
    setCreating(true);
    try {
      const details = toMeetingWriteRequest(value, "");
      const payload = editingMeeting ? {details,scope:value.scope,expectedVersion:editingMeeting.version,expectedSeriesVersion:editingMeeting.seriesVersion??null,replaceExceptions:value.replaceExceptions} : details;
      mutation.current = mutationKey(mutation.current, payload);
      details.mutationId = mutation.current.id;
      if(editingMeeting) {
        if(editingMeeting.version === undefined) throw new Error("API lịch chưa có phiên bản mới. Cần cập nhật backend trước khi lưu.");
        await updateBooking(editingMeeting.id,{details,scope:value.scope,expectedVersion:editingMeeting.version,expectedSeriesVersion:editingMeeting.seriesVersion??null,replaceExceptions:value.replaceExceptions},token);
      } else await createBooking(details,token);
      setCreateOpen(false);
      setEditingMeeting(null);
      setInitialForm(null);
      mutation.current = null;
      calendarRef.current?.getApi().refetchEvents();
    } catch (error) {
      setError(meetingProblem(error));
    } finally {
      createLock.current = false;
      setCreating(false);
    }
  }

  return <div className="flex flex-col gap-4">
    <div className="meeting-calendar rounded-2xl border border-separator bg-surface p-4 shadow-sm">
      {previewAllDay && <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted"><span>Đang minh họa sự kiện cả ngày — dữ liệu mẫu, không lưu hoặc gửi email.</span><Button size="sm" variant="tertiary" onPress={() => { setPreviewDismissed(true); const url = new URL(window.location.href); url.searchParams.delete("previewAllDay"); window.history.replaceState(null, "", url); }}>Tắt minh họa</Button></div>}
      {previewOverlap && <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted"><span>20 cuộc họp mẫu — kéo/resize để thử, không lưu hoặc gửi email. Tải lại để khôi phục.</span><Button size="sm" variant="tertiary" onPress={()=>{setOverlapDismissed(true);const url=new URL(window.location.href);url.searchParams.delete("previewOverlap");window.history.replaceState(null,"",url);}}>Tắt minh họa trùng giờ</Button></div>}
      <div className="meeting-toolbar mb-5 flex flex-wrap items-center gap-3">
        <h2 aria-live="polite" className="mr-auto text-xl font-semibold tracking-tight">{isMobile ? compactTitle : calendarTitle}</h2>
        <div className="meeting-add flex flex-wrap items-center gap-2">
          <Button size="sm" isIconOnly={isMobile} aria-label="Thêm cuộc họp" isDisabled={busy} onPress={() => {
            setError(null);
            setEditingMeeting(null);
            setInitialForm(newMeetingForm());
            setFormSession(session=>session+1);
            mutation.current=null;
            setCreateOpen(true);
          }}><Plus className="size-4" />{!isMobile && "Thêm cuộc họp"}</Button>
        </div>
        <Tabs className="w-fit max-w-full shrink-0" selectedKey={view} onSelectionChange={(key) => {
          setView(String(key));
          calendarRef.current?.getApi().changeView(String(key));
        }}>
          <Tabs.ListContainer><Tabs.List aria-label="Chế độ xem lịch">
            {[["timeGridDay", "Ngày"], ["timeGridWeek", "Tuần"], ["dayGridMonth", "Tháng"], ["listWeek", "Danh sách"]].map(([id, label]) => <Tabs.Tab isDisabled={busy} className="w-auto shrink-0 whitespace-nowrap" key={id} id={id}>{label}<Tabs.Indicator /></Tabs.Tab>)}
          </Tabs.List></Tabs.ListContainer>
        </Tabs>
        <div className="meeting-navigation flex items-center gap-1">
          <Button size="sm" variant="ghost" isIconOnly isDisabled={busy} aria-label="Khoảng trước" onPress={() => calendarRef.current?.getApi().prev()}><ChevronLeft className="size-4" /></Button>
          <Button size="sm" variant="outline" isDisabled={busy} onPress={() => calendarRef.current?.getApi().today()}>Hôm nay</Button>
          <Button size="sm" variant="ghost" isIconOnly isDisabled={busy} aria-label="Khoảng sau" onPress={() => calendarRef.current?.getApi().next()}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
      {(isLoading || busy) && <p role="status" className="mb-3 text-sm text-muted">{busy ? "Đang lưu cuộc họp…" : "Đang tải lịch họp…"}</p>}
      {(loadError || updateError) && <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
        <span>{loadError || updateError}</span>
        <Button size="sm" variant="secondary" isDisabled={isLoading || busy} onPress={() => calendarRef.current?.getApi().refetchEvents()}>{loadError ? "Thử lại" : "Tải lại lịch"}</Button>
        {updateError && <Button size="sm" variant="tertiary" onPress={() => setUpdateError(null)}>Đóng thông báo</Button>}
      </div>}
      <div ref={gridRef} aria-busy={busy} className={`meeting-grid-scroll ${view === "timeGridWeek" ? "meeting-grid-scroll--week" : ""}`}>
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale={viLocale}
        timeZone="UTC"
        now={calendarTime(new Date())}
        firstDay={1}
        weekends
        weekNumbers={false}
        weekText="Tuần"
        allDaySlot={false}
        allDayText="Cả ngày"
        nowIndicator
        selectable={false}
        editable={!busy}
        eventResizableFromStart
        eventStartEditable={!busy}
        eventDurationEditable={!busy}
        slotEventOverlap
        eventsSet={queueLayout}
        eventDidMount={arg=>{
          arg.el.dataset.meetingId=arg.event.id;
          const time=arg.event.extendedProps.isAllDay ? "Cả ngày" : `${arg.event.start?.toISOString().slice(11,16)}–${arg.event.end?.toISOString().slice(11,16)}`;
          arg.el.title=`${arg.event.title}\n${time}`;
          arg.el.setAttribute("aria-label",`${arg.event.title}, ${time}`);
          if (arg.view.type.startsWith("timeGrid")) arg.el.tabIndex=0;
          queueLayout();
        }}
        eventDisplay={isMobile && view === "dayGridMonth" ? "block" : "auto"}
        displayEventTime={!(isMobile && view === "dayGridMonth")}
        eventContent={arg => {
          if (arg.isResizing && arg.event.start && arg.event.end) {
            const format = (date: Date) => date.toLocaleString("vi-VN", { timeZone: "UTC", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
            return <div className="meeting-resize-preview sticky top-0 px-1 py-1 text-xs"><div className="font-medium">{format(arg.event.start)} → {format(arg.event.end)}</div><div>{arg.event.title}</div></div>;
          }
          return arg.event.extendedProps.isAllDay && arg.view.type.startsWith("timeGrid")
            ? <div className="sticky top-0 px-1 py-1 text-xs"><div className="font-medium">Cả ngày</div><div>{arg.event.title}</div></div> : true;
        }}
        eventAllow={(range, event) => {
          if (!event) return false;
          const candidate={id:event.id,start:range.start,end:range.end,allDay:range.allDay,extendedProps:event.extendedProps};
          const blocked=busy || isLoading || !!loadError;
          const operation = view.startsWith("timeGrid") && event.extendedProps.isAllDay ? "resize" : "drop";
          return event.extendedProps.preview ? canMovePreview(candidate,blocked) : canMoveMeeting(candidate,user?.id,blocked,operation);
        }}
        eventDrop={(change) => void handleTimeChange(change, user?.id)}
        eventResize={(change) => void handleTimeChange(change, user?.id, "resize")}
        eventClick={({ event, jsEvent }) => {
          jsEvent.preventDefault();
          if (!busy && !event.extendedProps.preview && event.start && event.end) setSelectedMeeting({
            ...event.extendedProps as Meeting,
            id: Number(event.id), title: String(event.extendedProps.title), kind: String(event.extendedProps.kind),
            location: String(event.extendedProps.location), organizerId: Number(event.extendedProps.organizerId),
            participantIds: event.extendedProps.participantIds ?? [],
            startUtc: event.extendedProps.startUtc ?? event.start.toISOString(), endUtc: event.extendedProps.endUtc ?? event.end.toISOString(),
          });
        }}
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        snapDuration="00:15:00"
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        dayHeaderContent={(arg) => <span className="meeting-day-heading"><span>{isMobile ? ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][arg.date.getUTCDay()] : arg.date.toLocaleDateString("vi-VN", { weekday: "short",timeZone:"UTC" })}</span>{arg.view.type !== "dayGridMonth" && <span className={arg.isToday ? "meeting-today-badge" : "meeting-day-number"}>{arg.date.getUTCDate()}</span>}</span>}
        views={{ dayGridMonth: { dayHeaderFormat: { weekday: "short" } }, timeGridWeek: { dayHeaderFormat: { weekday: "short", day: "numeric", month: "numeric" } }, timeGridDay: { dayHeaderFormat: { weekday: "long", day: "numeric", month: "numeric" } } }}
        scrollTime="08:00:00"
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        dragScroll
        height={isMobile ? (view === "dayGridMonth" ? "auto" : 600) : "min(760px, calc(100dvh - 220px))"}
        expandRows
        dayMaxEvents={isMobile ? 2 : true}
        moreLinkContent={arg => `+${arg.num} cuộc họp`}
        events={load}
        datesSet={handleDatesSet}
        loading={setLoading}
        headerToolbar={false}
        buttonText={{ today: "Hôm nay", month: "Tháng", week: "Tuần", day: "Ngày", list: "Danh sách" }}
      />
      </div>
    </div>
    <Modal.Backdrop isOpen={isCreateOpen} onOpenChange={(open) => { if (!createLock.current) setCreateOpen(open); }} isDismissable={!isCreating} isKeyboardDismissDisabled={isCreating}>
      <Modal.Container size="full" placement="center" scroll="inside">
        <Modal.Dialog className="meeting-booking-dialog">
          {!isCreating && <Modal.CloseTrigger aria-label="Đóng" />}
          <Modal.Header><Modal.Heading>{editingMeeting ? "Chỉnh sửa cuộc họp" : "Thêm cuộc họp"}</Modal.Heading></Modal.Header>
          {initialForm&&<MeetingForm key={formSession} initial={initialForm} isSaving={isCreating} onSubmit={value=>void saveMeeting(value)} onCancel={()=>setCreateOpen(false)} problem={error} token={token} organizerId={userId} onReload={()=>{setCreateOpen(false);calendarRef.current?.getApi().refetchEvents();}} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
    <Modal.Backdrop isOpen={selectedMeeting !== null} onOpenChange={(open) => { if (!open) setSelectedMeeting(null); }}>
      <Modal.Container size="lg" placement="center" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label="Đóng chi tiết" />
          <Modal.Header><Modal.Heading>Chi tiết cuộc họp</Modal.Heading></Modal.Header>
          <Modal.Body>{selectedMeeting && <dl className="grid gap-4 text-sm">
            {[
              ["Tên cuộc họp", selectedMeeting.title], ["Loại cuộc họp", selectedMeeting.kind],
              ["Phòng họp / địa điểm", selectedMeeting.location],
              ["Bắt đầu", selectedMeeting.isAllDay ? `${businessInput(selectedMeeting.startUtc).slice(0,10)} · Cả ngày` : new Date(selectedMeeting.startUtc).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"})],
              ["Kết thúc", selectedMeeting.isAllDay ? `${addDateDays(businessInput(selectedMeeting.endUtc),-1)} · hết ngày` : new Date(selectedMeeting.endUtc).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"})],
            ].map(([label, value]) => <div key={label}><dt className="text-muted">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
            <div><dt className="text-muted">Người tham gia</dt><dd className="mt-1 font-medium"><ParticipantNames ids={selectedMeeting.participantIds} token={token} /></dd></div>
            <p className="text-muted">{selectedMeeting.organizerId === user?.id ? "Bạn có thể kéo/thả hoặc thay đổi độ dài cuộc họp trên lịch để đổi giờ. Với cuộc họp lặp lại, thao tác này chỉ sửa một buổi; dùng Chỉnh sửa để chọn phạm vi chuỗi." : "Chỉ người tổ chức được thay đổi thời gian cuộc họp."}</p>
          </dl>}</Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={() => setSelectedMeeting(null)}>Đóng</Button>
            {selectedMeeting?.organizerId === userId && selectedMeeting && <Button isDisabled={busy} onPress={() => {
              setEditingMeeting(selectedMeeting);
              setInitialForm(fromMeeting(selectedMeeting));
              setFormSession(session=>session+1);
              mutation.current=null;
              setError(null);
              setSelectedMeeting(null);
              setCreateOpen(true);
            }}>Chỉnh sửa</Button>}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </div>;
}
