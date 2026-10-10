"use client";
import { Button, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { parseDate } from "@internationalized/date";
import { recurrenceDates, recurrenceSummary, weekdayOf, weekdays } from "../meetingForm";
import type { RecurrenceRule, Frequency } from "../meetingTypes";
import { MeetingDateField } from "./MeetingDateField";
export function MeetingSelect({ label, value, options, onChange, disabled, hideLabel = false }: { label: string; value: string; options: [string,string][]; onChange: (value: string) => void; disabled?: boolean; hideLabel?: boolean }) {
  return <Select fullWidth isDisabled={disabled} selectedKey={value} onSelectionChange={key => { if(key !== null) onChange(String(key)); }}><Label className={hideLabel ? "sr-only" : undefined}>{label}</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox>{options.map(([id,text]) => <ListBox.Item id={id} key={id} textValue={text}>{text}<ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></Select.Popover></Select>;
}
export function MeetingRecurrenceEditor({ value: saved, startDate, onChange: commit, disabled, error, hideLabel = false }: { value: RecurrenceRule | null; startDate: string; onChange: (rule: RecurrenceRule|null) => void; disabled?: boolean; error?: string; hideLabel?: boolean }) {
  const [custom,setCustom]=useState(false);
  const value = saved;
  const preset = !value ? "none" : custom ? "custom" : value.frequency === "weekly" && weekdays.slice(0,5).every(day=>value.weekdays.includes(day)) && value.weekdays.length === 5 && value.interval === 1 ? "weekdays" : value.interval !== 1 || value.frequency === "weekly" && value.weekdays.length > 1 ? "custom" : value.frequency;
  const presets: [string,string][] = [["none","Không lặp lại"],["weekdays","Mọi ngày trong tuần (T2–T6)"],["daily","Hàng ngày"],["weekly","Hàng tuần"],["monthly","Hàng tháng"],["yearly","Hàng năm"],["custom",preset === "custom" && saved ? recurrenceSummary(saved) : "Tùy chỉnh"]];
  const makeRule = (key:string):RecurrenceRule => ({ frequency: key === "weekdays" || key === "custom" ? "weekly" : key as Frequency, interval: 1, weekdays: key === "weekdays" ? weekdays.slice(0,5) : key === "weekly" || key === "custom" ? [weekdayOf(startDate)] : [], until: startDate ? parseDate(startDate.slice(0,10)).add({months:1}).toString() : null, count: null });
  const openCustom = () => { setCustom(true); commit(saved ?? makeRule("custom")); };
  return <div><MeetingSelect label="Lặp lại" hideLabel={hideLabel} value={preset} disabled={disabled} options={presets} onChange={key => {if(key === "custom"){openCustom();return;}setCustom(false);commit(key === "none" ? null : makeRule(key));}} />
    <RecurrenceDetails>
    {saved && (preset === "custom" ? <section aria-label="Thiết lập lặp lại" className="rounded-xl border border-separator bg-surface-secondary p-4"><RecurrenceControls value={saved} startDate={startDate} onChange={commit} disabled={disabled} /></section> : <MeetingDateField label="Ngày kết thúc lặp" allDay value={saved.until ?? (saved.count !== null ? recurrenceDates(startDate,saved).at(-1) ?? "" : "")} minDate={startDate.slice(0,10)} isDisabled={disabled} onChange={until => commit({...saved,count:null,until:until || null})} />)}
    </RecurrenceDetails>
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
  </div>;
}
function RecurrenceDetails({ children }: { children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = content.current!;
    const measure = () => setHeight(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div className="meeting-recurrence-details" style={{ height: height ?? undefined }}>
    <div ref={content} className="flow-root">{children && <div className="pt-3">{children}</div>}</div>
  </div>;
}
function RecurrenceControls({value,startDate,onChange,disabled}:{value:RecurrenceRule;startDate:string;onChange:(rule:RecurrenceRule)=>void;disabled?:boolean}) {
  return <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2"><TextField value={String(value.interval)} onChange={text => onChange({...value, interval:Number(text)})} isDisabled={disabled}><Label>Lặp lại mỗi</Label><Input type="number" min={1} max={366} /></TextField><MeetingSelect label="Đơn vị" value={value.frequency} options={[["daily","Ngày"],["weekly","Tuần"],["monthly","Tháng"],["yearly","Năm"]]} disabled={disabled} onChange={key => onChange({...value, frequency:key as Frequency, weekdays:key === "weekly" ? [weekdayOf(startDate)] : []})} /></div>
      {value.frequency === "weekly" && <div className="flex flex-wrap gap-1" role="group" aria-label="Thứ lặp lại">{weekdays.map((day,index) => <Button key={day} size="sm" variant={value.weekdays.includes(day) ? "primary" : "secondary"} isDisabled={disabled} aria-pressed={value.weekdays.includes(day)} onPress={() => onChange({...value, weekdays:value.weekdays.includes(day) ? value.weekdays.filter(d => d !== day) : [...value.weekdays,day]})}>{["T2","T3","T4","T5","T6","T7","CN"][index]}</Button>)}</div>}
      <MeetingDateField label="Ngày kết thúc lặp" allDay value={value.until ?? (value.count !== null ? recurrenceDates(startDate,value).at(-1) ?? "" : "")} minDate={startDate.slice(0,10)} isDisabled={disabled} onChange={until => onChange({...value,count:null,until:until || null})} />
      <p className="text-xs text-muted">{recurrenceSummary(value)} {value.until&&`Dự kiến ${recurrenceDates(startDate,value).length>366 ? "hơn 366" : recurrenceDates(startDate,value).length} buổi. `}Tối đa 366 buổi; hệ thống kiểm tra toàn bộ khi lưu.</p>
    </div>
  ;
}
