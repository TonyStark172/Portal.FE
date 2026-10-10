import type { EventApi } from "@fullcalendar/core";
import { overlapLayout } from "./overlapLayout";
export type LayoutEvent = Pick<EventApi,"id"|"start"|"end"|"display"|"title"|"extendedProps">;
export function applyTimeGridLayout(root: HTMLElement, events: LayoutEvent[]) {
  const byId=new Map(events.map(event=>[event.id,event]));
  root.querySelectorAll<HTMLElement>(".fc-timegrid-col[data-date]").forEach(column=>{
    const dayStart=new Date(`${column.dataset.date}T00:00:00Z`).getTime();
    const dayEnd=dayStart+86400000;
    const layout=overlapLayout(events.filter(event=>event.start&&event.end&&event.start.getTime()<dayEnd&&event.end.getTime()>dayStart&&event.display!=="background").map(event=>({
      id:event.id,start:Math.max(dayStart,event.start!.getTime()),end:Math.min(dayEnd,event.end!.getTime()),
    })));
    column.querySelectorAll<HTMLElement>(".fc-timegrid-event[data-meeting-id]:not(.fc-event-mirror)").forEach(card=>{
      const event=byId.get(card.dataset.meetingId!);
      const position=layout.get(card.dataset.meetingId!);
      if(!event||!position||!card.parentElement) return;
      const time=event.extendedProps.isAllDay ? "Cả ngày" : `${event.start?.toISOString().slice(11,16)}–${event.end?.toISOString().slice(11,16)}`;
      card.title=`${event.title}\n${time}`;
      card.setAttribute("aria-label",`${event.title}, ${time}`);
      const harness=card.parentElement;
      harness.classList.add("meeting-overlap-harness");
      harness.style.setProperty("--meeting-left",`${position.left}%`);
      harness.style.setProperty("--meeting-right",`${100-position.left-position.width}%`);
      harness.style.setProperty("--meeting-layer",String(position.layer));
    });
  });
}
