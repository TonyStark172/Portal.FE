import type { EventApi } from "@fullcalendar/core";
import { overlapLayout } from "./overlapLayout";
export type LayoutEvent = Pick<EventApi,"id"|"start"|"end"|"display"|"title"|"extendedProps"> & Partial<Pick<EventApi,"classNames">>;
/**
 * Names a meeting's card, as its tooltip and its accessible name: its title and time, then its state when it is on or
 * over (`note`, e.g. "(đang họp)").
 */
export function describeEvent(card: HTMLElement, event: LayoutEvent, allDayLabel: string, note = "") {
  const time = event.extendedProps.isAllDay ? allDayLabel : `${event.start?.toISOString().slice(11, 16)}–${event.end?.toISOString().slice(11, 16)}`;
  card.title = note ? `${event.title}\n${time}\n${note}` : `${event.title}\n${time}`;
  card.setAttribute("aria-label", note ? `${event.title}, ${time} ${note}` : `${event.title}, ${time}`);
}
/** `stateNote`: what a card's name says of its meeting's state (describeEvent). */
export function applyTimeGridLayout(root: HTMLElement, events: LayoutEvent[], allDayLabel = "Cả ngày", stateNote: (event: LayoutEvent) => string = () => "") {
  const byId=new Map(events.map(event=>[event.id,event]));
  root.querySelectorAll<HTMLElement>(".fc-timegrid-col[data-date]").forEach(column=>{
    const dayStart=new Date(`${column.dataset.date}T00:00:00Z`).getTime();
    const dayEnd=dayStart+86400000;
    // An all-day meeting fills the day behind the others (layer 0) instead of pushing every meeting of the day aside.
    const layout=overlapLayout(events.filter(event=>!event.extendedProps.isAllDay&&event.start&&event.end&&event.start.getTime()<dayEnd&&event.end.getTime()>dayStart&&event.display!=="background").map(event=>({
      id:event.id,start:Math.max(dayStart,event.start!.getTime()),end:Math.min(dayEnd,event.end!.getTime()),
    })));
    column.querySelectorAll<HTMLElement>(".fc-timegrid-event[data-meeting-id]:not(.fc-event-mirror)").forEach(card=>{
      const event=byId.get(card.dataset.meetingId!);
      const position=event?.extendedProps.isAllDay ? {left:0,width:100,layer:0} : layout.get(card.dataset.meetingId!);
      if(!event||!position||!card.parentElement) return;
      // A "+N" entry takes its place among the others but keeps its own label.
      if(!event.extendedProps.more) describeEvent(card,event,allDayLabel,stateNote(event));
      const harness=card.parentElement;
      harness.classList.add("meeting-overlap-harness");
      harness.style.setProperty("--meeting-left",`${position.left}%`);
      harness.style.setProperty("--meeting-right",`${100-position.left-position.width}%`);
      harness.style.setProperty("--meeting-layer",String(position.layer));
    });
  });
}
