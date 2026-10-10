import { expect, test } from "vitest";
import { applyTimeGridLayout } from "./timeGridLayout";

test("updates accessible time and tooltip on the same card after a time change", () => {
  const root=document.createElement("div");
  root.innerHTML='<div class="fc-timegrid-col" data-date="2026-10-10"><div><a class="fc-timegrid-event" data-meeting-id="1"></a></div></div>';
  const event={id:"1",title:"Họp · 501",start:new Date("2026-10-10T10:00:00Z"),end:new Date("2026-10-10T12:00:00Z"),display:"auto",extendedProps:{}};
  applyTimeGridLayout(root,[event]);
  event.start=new Date("2026-10-10T14:00:00Z");event.end=new Date("2026-10-10T16:00:00Z");
  applyTimeGridLayout(root,[event]);
  const card=root.querySelector("a")!;
  expect(card.getAttribute("title")).toBe("Họp · 501\n14:00–16:00");
  expect(card.getAttribute("aria-label")).toBe("Họp · 501, 14:00–16:00");
});
test("does not apply committed positions to a drag mirror", () => {
  const root=document.createElement("div");
  root.innerHTML='<div class="fc-timegrid-col" data-date="2026-10-10"><div><a class="fc-timegrid-event" data-meeting-id="1"></a></div><div><a class="fc-timegrid-event fc-event-mirror" data-meeting-id="1"></a></div></div>';
  applyTimeGridLayout(root,[{id:"1",title:"Họp",start:new Date("2026-10-10T10:00:00Z"),end:new Date("2026-10-10T12:00:00Z"),display:"auto",extendedProps:{}}]);
  expect(root.querySelector("a:not(.fc-event-mirror)")!.parentElement!.classList.contains("meeting-overlap-harness")).toBe(true);
  expect(root.querySelector(".fc-event-mirror")!.parentElement!.classList.contains("meeting-overlap-harness")).toBe(false);
});
