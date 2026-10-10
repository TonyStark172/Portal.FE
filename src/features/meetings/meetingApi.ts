import { meetingRequest, type MeetingEvent } from "./calendarEvents";
import { BUSINESS_OFFSET_MS } from "./meetingForm";
import type { MeetingWriteRequest, MeetingEditRequest, MeetingMutationResult, MeetingConflict } from "./meetingTypes";
import { ApiProblemError, type ApiProblem } from "@/shared/api/problem";
export type MeetingProblem = ApiProblem & { conflicts?: MeetingConflict[]; totalCount?: number };
export function meetingProblem(error: unknown): MeetingProblem { return error instanceof ApiProblemError ? error.problem : {status:0,code:"network_error",detail:error instanceof Error ? error.message : "Không thể lưu cuộc họp."}; }
export const createBooking = (request: MeetingWriteRequest, token: string|null) => meetingRequest<MeetingMutationResult>("/api/Meetings/bookings", token, {method:"POST", body:JSON.stringify(request)});
export const updateBooking = (id: number, request: MeetingEditRequest, token: string|null) => meetingRequest<MeetingMutationResult>(`/api/Meetings/${id}/booking`, token, {method:"PUT", body:JSON.stringify(request)});
// Retain a mutation key across ambiguous network failures; changing any payload field gets a new key.
export function mutationKey(cache: { fingerprint: string; id: string } | null, payload: unknown) {
  const fingerprint = JSON.stringify(payload);
  return cache?.fingerprint === fingerprint ? cache : {fingerprint,id:crypto.randomUUID()};
}
export function occurrenceUpdate(event:MeetingEvent,mutationId:string):MeetingEditRequest {
  const meeting=event.extendedProps;
  if(meeting.version===undefined || !event.start || !event.end) throw new Error("API lịch chưa có phiên bản mới. Cần cập nhật backend trước khi đổi lịch.");
  return {details:{title:meeting.title??"",kind:meeting.kind??"",location:meeting.location??"",schedule:{startUtc:new Date(event.start.getTime()-BUSINESS_OFFSET_MS).toISOString(),endUtc:new Date(event.end.getTime()-BUSINESS_OFFSET_MS).toISOString(),isAllDay:event.allDay,recurrence:null},audience:null,participantIds:null,mutationId},scope:"occurrence",expectedVersion:meeting.version,expectedSeriesVersion:meeting.seriesVersion??null,replaceExceptions:false};
}
export function createOccurrenceSaver(){
  let pending:{fingerprint:string;id:string}|null=null;
  return async(event:MeetingEvent,token:string|null)=>{
    const request=occurrenceUpdate(event,"");
    pending=mutationKey(pending,{meetingId:event.id,request});
    request.details.mutationId=pending.id;
    await updateBooking(Number(event.id),request,token);
    pending=null;
  };
}
