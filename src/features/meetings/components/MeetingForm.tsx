"use client";
import { useRef, useState } from "react";
import { Button, Checkbox, Input, Label, Modal, Switch, TextField } from "@heroui/react";
import type { EditScope, MeetingFormValue } from "../meetingTypes";
import { changeEditScope, validateMeetingForm } from "../meetingForm";
import type { MeetingProblem } from "../meetingApi";
import { MeetingDateField } from "./MeetingDateField";
import { MeetingRecurrenceEditor, MeetingSelect } from "./MeetingRecurrenceEditor";
import { MeetingAudiencePicker } from "./MeetingAudiencePicker";
import { MeetingConflictList } from "./MeetingConflictList";
export function MeetingForm({initial,isSaving,onSubmit,onCancel,problem,token,organizerId,onReload}:{initial:MeetingFormValue;isSaving:boolean;onSubmit:(value:MeetingFormValue)=>void;onCancel:()=>void;problem:MeetingProblem|null;token:string|null;organizerId?:number;onReload?:()=>void}) {
  const [value,setValue] = useState(initial);
  const [errors,setErrors] = useState<Record<string,string>>({});
  const [audienceBusy,setAudienceBusy] = useState(false);
  const timed = useRef({start:initial.isAllDay ? `${initial.start}T09:00` : initial.start,end:initial.isAllDay ? `${initial.end}T10:00` : initial.end});
  const update = (patch:Partial<MeetingFormValue>) => setValue(old=>({...old,...patch}));
  const submit = () => {if(isSaving||audienceBusy)return;const next=validateMeetingForm(value);setErrors(next);if(!Object.keys(next).length) onSubmit(value);};
  const series = !!initial.editing?.seriesId;
  const fieldError = (field:string) => errors[field] ?? Object.entries(problem?.errors??{}).find(([key])=>key.toLowerCase().split(".").at(-1)===field.toLowerCase())?.[1]?.[0];
  return <><Modal.Body className="meeting-form-body">
    <div className="grid gap-5">
      <section className="order-1 grid gap-3 sm:grid-cols-2"><h3 className="text-sm font-semibold sm:col-span-2">Thông tin cuộc họp</h3>{([["title","Tên cuộc họp",200],["kind","Loại cuộc họp",100],["location","Phòng họp / địa điểm",200]] as const).map(([field,label,max])=><div key={field} className={field === "title" ? "sm:col-span-2" : undefined}><TextField isDisabled={isSaving} isRequired isInvalid={!!fieldError(field)} value={value[field]} onChange={text=>update({[field]:text})}><Label>{label}</Label><Input spellCheck={false} maxLength={max} /></TextField>{fieldError(field)&&<p className="mt-1 text-xs text-danger">{fieldError(field)}</p>}</div>)}</section>
      <section className="order-2 min-w-0 space-y-3"><MeetingAudiencePicker snapshotIds={value.participantIds} selection={value.audience} organizerId={organizerId} token={token} disabled={isSaving} onBusyChange={setAudienceBusy} onChange={audience=>update({audience})} onSnapshotChange={participantIds=>update({participantIds})} /></section>
        <div className="order-3 grid items-stretch gap-5 border-t border-separator pt-5 md:grid-cols-2"><section aria-label="Thời gian cuộc họp" className="min-w-0 space-y-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Thời gian · UTC+7</h3><Switch size="sm" isSelected={value.isAllDay} isDisabled={isSaving} onChange={isAllDay=>{
          if(isAllDay){timed.current={start:value.start,end:value.end};update({isAllDay,start:value.start.slice(0,10),end:value.end.slice(0,10)});}
          else update({isAllDay,start:`${value.start.slice(0,10)}T${timed.current.start.split("T")[1]??"09:00"}`,end:`${value.end.slice(0,10)}T${timed.current.end.split("T")[1]??"10:00"}`});
        }}><Switch.Content><Switch.Control><Switch.Thumb /></Switch.Control><Label>Cả ngày</Label></Switch.Content></Switch></div>
          <div className="grid gap-3"><MeetingDateField label="Bắt đầu" value={value.start} allDay={value.isAllDay} isDisabled={isSaving} error={fieldError("start")} onChange={start=>update({start})} /><MeetingDateField label="Kết thúc" value={value.end} allDay={value.isAllDay} isDisabled={isSaving} error={fieldError("end")} onChange={end=>update({end})} /></div>
          {value.isAllDay&&<p className="text-xs text-muted">Ngày kết thúc bao gồm cả ngày cuối.</p>}
        </section><section aria-label="Lặp lại cuộc họp" className="min-w-0 space-y-4 md:border-l md:border-separator md:pl-5"><h3 className="text-sm font-semibold">Lặp lại</h3>
          {series&&<MeetingSelect label="Phạm vi chỉnh sửa" value={value.scope} disabled={isSaving} options={[["occurrence","Chỉ buổi này"],["following","Từ buổi này trở đi"],["series","Toàn chuỗi (các buổi chưa kết thúc)"]]} onChange={scope=>setValue(old=>changeEditScope(old,scope as EditScope))} />}
          {series&&value.scope==="occurrence" ? <p className="text-xs text-muted">Chỉ sửa buổi này, không thay quy tắc chuỗi. Muốn đổi lặp lại, chọn phạm vi từ buổi này hoặc toàn chuỗi.</p> : <MeetingRecurrenceEditor hideLabel value={value.recurrence} startDate={value.start} onChange={recurrence=>update({recurrence})} disabled={isSaving || !!initial.editing&&!series} error={fieldError("recurrence")} />}
          {!!initial.editing&&!series&&<p className="text-xs text-muted">Cuộc họp đơn hiện chưa thể chuyển thành chuỗi khi chỉnh sửa. Chọn lặp lại lúc tạo cuộc họp mới.</p>}
          {series&&value.scope!=="occurrence"&&<p className="text-xs text-muted">Giờ gốc theo quy tắc được dùng cho phạm vi chuỗi nếu bạn chưa đổi thời gian. Các buổi đã kết thúc được giữ nguyên.{value.scope==="following"&&value.recurrence?.count!=null&&` Nếu giữ nguyên quy tắc, số buổi đang hiển thị là tổng chuỗi; còn ${Math.max(0,value.recurrence.count-(initial.editing?.occurrenceKey??0))} buổi từ vị trí này.`}</p>}
          {series&&value.scope!=="occurrence"&&<Checkbox isDisabled={isSaving} isSelected={value.replaceExceptions} onChange={replaceExceptions=>update({replaceExceptions})}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>Tôi đồng ý thay thế các buổi đã chỉnh riêng trong phạm vi này</Checkbox.Content></Checkbox>}
        </section></div>
    </div>
    {problem&&<div className="mt-3"><MeetingConflictList problem={problem} />{problem.code==="staleVersion"&&<Button variant="secondary" size="sm" className="mt-2" isDisabled={isSaving} onPress={onReload}>Đóng bản nháp và tải lại lịch</Button>}</div>}
  </Modal.Body><Modal.Footer className="border-t border-separator pt-4"><Button variant="tertiary" isDisabled={isSaving} onPress={onCancel}>Hủy</Button><Button isDisabled={isSaving||audienceBusy} onPress={submit}>{isSaving?"Đang lưu…":initial.editing?"Lưu thay đổi":"Tạo cuộc họp"}</Button></Modal.Footer></>;
}
