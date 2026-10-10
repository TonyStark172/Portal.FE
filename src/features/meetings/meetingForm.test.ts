import { expect, test } from "vitest";
import * as form from "./meetingForm";

const base = { title: "Tập huấn", kind: "Nội bộ", location: "503", start: "2030-01-07T09:00", end: "2030-01-07T10:00", isAllDay: false, recurrence: null, audience: null, participantIds: [2], scope: "occurrence", replaceExceptions: false } as const;
test("serializes all-day inclusive dates to exclusive UTC+7 boundaries", () => {
  const request = form.toMeetingWriteRequest({ ...base, participantIds: [2], isAllDay: true, start: "2030-01-07", end: "2030-01-08" }, "mutation");
  expect(request.schedule).toMatchObject({ startUtc: "2030-01-06T17:00:00.000Z", endUtc: "2030-01-08T17:00:00.000Z", isAllDay: true });
});
test("preserves stored instants and snapshot when editing only the title", () => {
  const value = form.fromMeeting({ id: 1, title: "Old", kind: "Nội bộ", location: "503", startUtc: "2030-01-07T02:00:45.123Z", endUtc: "2030-01-07T03:00:45.123Z", participantIds: [2,3], organizerId: 2, version: 4 });
  const request = form.toMeetingWriteRequest({ ...value, title: "New" }, "mutation");
  expect(request.schedule.startUtc).toBe("2030-01-07T02:00:45.123Z");
  expect(request.audience).toBeNull();
  expect(request.participantIds).toBeNull();
});
test("rejects weekly recurrence without its anchor weekday and overlarge count", () => {
  expect(form.validateMeetingForm({ ...base, participantIds: [2], recurrence: { frequency: "weekly", interval: 1, weekdays: ["tuesday"], count: 367, until: null } }).recurrence).toBeTruthy();
});
test("explains missing calendar dates for monthly and yearly repeats", () => {
  expect(form.recurrenceSummary({ frequency: "monthly", interval: 1, weekdays: [], count: 10, until: null })).toContain("bỏ qua");
  expect(form.recurrenceSummary({ frequency: "yearly", interval: 1, weekdays: [], count: 10, until: null })).toContain("bỏ qua");
});

test.each(["following","series"] as const)("%s edits restore a dragged exception's original weekly anchor",(scope)=>{
  const meeting={id:1,title:"Old",kind:"Nội bộ",location:"503",startUtc:"2030-01-16T02:00:00Z",endUtc:"2030-01-16T03:00:00Z",participantIds:[2],organizerId:2,version:4,seriesId:9,occurrenceKey:1,isException:true,seriesSchedule:{startUtc:"2030-01-07T02:00:00Z",endUtc:"2030-01-07T03:00:00Z",isAllDay:false,recurrence:{frequency:"weekly" as const,interval:1,weekdays:["monday" as const],count:10,until:null}}};
  const value=form.changeEditScope(form.fromMeeting(meeting),scope);
  expect(value.start).toBe("2030-01-14T09:00");
  expect(form.validateMeetingForm(value)).toEqual({});
  expect(Date.parse(form.toMeetingWriteRequest(value,"m").schedule.startUtc)).toBe(Date.parse("2030-01-14T02:00:00Z"));
  expect(form.changeEditScope(value,"occurrence").start).toBe("2030-01-16T09:00");
});

test.each(["following","series"] as const)("%s monthly anchors skip nonexistent dates and retain explicitly changed times",(scope)=>{
  const meeting={id:1,title:"Old",kind:"Nội bộ",location:"503",startUtc:"2030-04-03T02:00:00Z",endUtc:"2030-04-03T03:00:00Z",participantIds:[2],organizerId:2,version:4,seriesId:9,occurrenceKey:1,isException:true,seriesSchedule:{startUtc:"2030-01-31T02:00:00Z",endUtc:"2030-01-31T03:00:00Z",isAllDay:false,recurrence:{frequency:"monthly" as const,interval:1,weekdays:[],count:10,until:null}}};
  expect(form.changeEditScope(form.fromMeeting(meeting),scope).start).toBe("2030-03-31T09:00");
  expect(form.changeEditScope({...form.fromMeeting(meeting),start:"2030-04-03T11:00"},"series").start).toBe("2030-04-03T11:00");
});
test("yearly preview counts actual leap dates beyond ten years for count rules",()=>{
  expect(form.recurrenceDates("2032-02-29",{frequency:"yearly",interval:1,weekdays:[],count:4,until:null})).toEqual(["2032-02-29","2036-02-29","2040-02-29","2044-02-29"]);
});
