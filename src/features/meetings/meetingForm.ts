import type { EditScope, Meeting, MeetingFormValue, MeetingWriteRequest, RecurrenceRule, Weekday } from "./meetingTypes";
export const BUSINESS_OFFSET_MS = 7 * 60 * 60 * 1000;
export const weekdays: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
export function businessInput(instant: string | Date) { return new Date(new Date(instant).getTime() + BUSINESS_OFFSET_MS).toISOString().slice(0, 16); }
export function businessUtc(local: string) { return new Date(`${local.length === 10 ? `${local}T00:00` : local}+07:00`).toISOString(); }
export function addDateDays(date: string, days: number) { const value = new Date(`${date.slice(0, 10)}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
export function weekdayOf(date: string): Weekday { return weekdays[(new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay() + 6) % 7]; }
export function newMeetingForm(now = new Date()): MeetingFormValue {
  const start = new Date(Math.ceil(now.getTime() / 900000) * 900000);
  return { title: "", kind: "Họp nội bộ", location: "", start: businessInput(start), end: businessInput(new Date(start.getTime() + 3600000)), isAllDay: false, recurrence: null, audience: null, participantIds: [], scope: "occurrence", replaceExceptions: false };
}
export function fromMeeting(meeting: Meeting): MeetingFormValue {
  return { title: meeting.title, kind: meeting.kind, location: meeting.location,
    start: meeting.isAllDay ? businessInput(meeting.startUtc).slice(0, 10) : businessInput(meeting.startUtc),
    end: meeting.isAllDay ? addDateDays(businessInput(meeting.endUtc), -1) : businessInput(meeting.endUtc),
    isAllDay: !!meeting.isAllDay, recurrence: meeting.seriesSchedule?.recurrence ?? null, audience: null,
    participantIds: [...meeting.participantIds], scope: "occurrence", replaceExceptions: false, editing: meeting };
}
// Used only to recover a form's original anchor/estimate, never to generate calendar events.
export function recurrenceDates(startDate:string,rule:RecurrenceRule): string[] {
  const start=new Date(`${startDate.slice(0,10)}T00:00:00Z`);
  const result:string[]=[];
  if(!Number.isFinite(start.getTime()) || !Number.isInteger(rule.interval) || rule.interval<1) return result;
  const max=rule.count ?? 367;
  for(let step=0;step<10000 && result.length<max;step++){
    const date=new Date(start);
    if(rule.frequency==="monthly"){
      date.setUTCDate(1);date.setUTCMonth(start.getUTCMonth()+step*rule.interval);
      const month=date.getUTCMonth();date.setUTCDate(start.getUTCDate());
      if(date.getUTCMonth()!==month)continue;
    }else if(rule.frequency==="yearly"){
      date.setUTCFullYear(start.getUTCFullYear()+step*rule.interval);
      if(date.getUTCMonth()!==start.getUTCMonth())continue;
    }else{
      const offset=rule.frequency==="daily" ? step*rule.interval : Math.floor(step/7)*rule.interval*7+step%7-(start.getUTCDay()+6)%7;
      if(offset<0)continue;
      date.setUTCDate(start.getUTCDate()+offset);
    }
    if(date.getUTCFullYear()>9999)break;
    const day=date.toISOString().slice(0,10);
    if(rule.until && day>rule.until)break;
    const match=rule.frequency!=="weekly" || (rule.weekdays.length?rule.weekdays:[weekdayOf(startDate)]).includes(weekdayOf(day));
    if(match)result.push(day);
  }
  return result;
}
function scopeAnchor(meeting:Meeting,scope:EditScope):Meeting {
  const schedule=meeting.seriesSchedule;
  if(scope==="occurrence" || !schedule?.recurrence || meeting.occurrenceKey==null) return meeting;
  const day=recurrenceDates(businessInput(schedule.startUtc),schedule.recurrence)[meeting.occurrenceKey];
  if(!day) return meeting;
  const startUtc=businessUtc(`${day}T${businessInput(schedule.startUtc).slice(11)}`);
  // Preserve seconds and milliseconds from the original rule.
  const start=new Date(startUtc).getTime()+new Date(schedule.startUtc).getUTCSeconds()*1000+new Date(schedule.startUtc).getUTCMilliseconds();
  return {...meeting,startUtc:new Date(start).toISOString(),endUtc:new Date(start+Date.parse(schedule.endUtc)-Date.parse(schedule.startUtc)).toISOString(),isAllDay:schedule.isAllDay};
}
export function changeEditScope(value:MeetingFormValue,scope:EditScope):MeetingFormValue {
  if(!value.editing) return {...value,scope};
  const current=fromMeeting(scopeAnchor(value.editing,value.scope));
  const next=fromMeeting(scopeAnchor(value.editing,scope));
  const untouched=value.start===current.start && value.end===current.end && value.isAllDay===current.isAllDay;
  return {...value,scope,replaceExceptions:false,...(untouched ? {start:next.start,end:next.end,isAllDay:next.isAllDay} : {})};
}
export function toMeetingWriteRequest(value: MeetingFormValue, mutationId: string): MeetingWriteRequest {
  const reference=value.editing ? scopeAnchor(value.editing,value.scope) : null;
  const original = reference ? fromMeeting(reference) : null;
  const preserve = !!original && value.isAllDay === original.isAllDay;
  const startUtc = preserve && value.start === original!.start ? reference!.startUtc : businessUtc(value.start);
  const endUtc = preserve && value.end === original!.end ? reference!.endUtc : businessUtc(value.isAllDay ? addDateDays(value.end, 1) : value.end);
  const sameSnapshot = value.editing && [...new Set(value.participantIds)].sort().join(",") === [...new Set(value.editing.participantIds)].sort().join(",");
  return { title: value.title.trim(), kind: value.kind.trim(), location: value.location.trim(),
    schedule: { startUtc, endUtc, isAllDay: value.isAllDay, recurrence: value.editing && value.scope === "occurrence" ? null : value.recurrence },
    audience: value.audience, participantIds: value.audience || sameSnapshot ? null : [...new Set(value.participantIds)], mutationId };
}
export function recurrenceSummary(rule: RecurrenceRule | null): string {
  if (!rule) return "Không lặp lại";
  const unit = { daily: "ngày", weekly: "tuần", monthly: "tháng", yearly: "năm" }[rule.frequency];
  const days = rule.frequency === "weekly" && rule.weekdays.length ? ` · ${rule.weekdays.map(d => ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][weekdays.indexOf(d)]).join(", ")}` : "";
  return `Mỗi ${rule.interval} ${unit}${days} · ${rule.count !== null ? `${rule.count} buổi` : `đến ${rule.until ?? "chưa chọn ngày"}`}${["monthly", "yearly"].includes(rule.frequency) ? ". Ngày không tồn tại sẽ được bỏ qua." : ""}`;
}
export function validateMeetingForm(value: MeetingFormValue): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, limit] of [["title", 200], ["kind", 100], ["location", 200]] as const)
    if (!value[field].trim() || value[field].trim().length > limit) errors[field] = `Bắt buộc, tối đa ${limit} ký tự.`;
  try {
    const start = new Date(businessUtc(value.start)).getTime();
    const end = new Date(businessUtc(value.isAllDay ? addDateDays(value.end, 1) : value.end)).getTime();
    if (end - start < 900000) errors.end = "Kết thúc phải sau bắt đầu ít nhất 15 phút.";
  } catch { errors.start = "Chọn đầy đủ ngày và giờ bắt đầu/kết thúc."; }
  const rule = value.editing && value.scope === "occurrence" ? null : value.recurrence;
  if (rule) {
    if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 366 || (rule.count === null) === (rule.until === null) || rule.count !== null && (!Number.isInteger(rule.count) || rule.count < 1 || rule.count > 366)) errors.recurrence = "Chọn khoảng lặp 1–366 và số buổi 1–366 hoặc ngày kết thúc.";
    if (rule.until && (!Number.isFinite(Date.parse(rule.until)) || rule.until < value.start.slice(0,10) || (Date.parse(rule.until) - Date.parse(value.start.slice(0,10))) / 86400000 > 3653)) errors.recurrence = "Ngày kết thúc từ ngày bắt đầu và trong tối đa 10 năm.";
    if (rule.frequency === "weekly" && rule.weekdays.length && !rule.weekdays.includes(weekdayOf(value.start))) errors.recurrence = "Thứ của ngày bắt đầu phải thuộc các thứ lặp đã chọn.";
  }
  return errors;
}
