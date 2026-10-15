"use client";
import { Input, Label, ListBox, Select, TextField } from "@heroui/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { parseDate } from "@internationalized/date";
import { recurrenceDates, recurrenceSummary, weekdayOf, weekdays } from "../meetingForm";
import type { RecurrenceRule, Frequency } from "../meetingTypes";
import { MeetingDateField } from "./MeetingDateField";
import { WeekdayChips } from "./WeekdayChips";
import { useLocale } from "@/shared/i18n/LocaleProvider";

/** `variant="secondary"` gives the trigger the filled look of the fields beside it (a settings form's inputs). */
export function MeetingSelect({ label, value, options, onChange, disabled, hideLabel = false, variant }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void; disabled?: boolean; hideLabel?: boolean; variant?: "primary" | "secondary" }) {
  return (
    <Select fullWidth variant={variant} isDisabled={disabled} selectedKey={value} onSelectionChange={key => { if (key !== null) onChange(String(key)); }}>
      <Label className={hideLabel ? "sr-only" : undefined}>{label}</Label>
      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
      <Select.Popover>
        <ListBox>{options.map(([id, text]) => <ListBox.Item id={id} key={id} textValue={text}>{text}<ListBox.ItemIndicator /></ListBox.Item>)}</ListBox>
      </Select.Popover>
    </Select>
  );
}

type Preset = "none" | "weekdays" | "Daily" | "Weekly" | "Monthly" | "Yearly" | "custom";

function presetOf(rule: RecurrenceRule | null, custom: boolean): Preset {
  if (!rule) return "none";
  if (custom) return "custom";
  const workweek = rule.frequency === "Weekly" && rule.interval === 1 && rule.weekdays.length === 5 && weekdays.slice(0, 5).every(day => rule.weekdays.includes(day));
  if (workweek) return "weekdays";
  return rule.interval !== 1 || rule.frequency === "Weekly" && rule.weekdays.length > 1 ? "custom" : rule.frequency;
}

export function MeetingRecurrenceEditor({ value: saved, startDate, onChange: commit, disabled, error, hideLabel = false }: { value: RecurrenceRule | null; startDate: string; onChange: (rule: RecurrenceRule | null) => void; disabled?: boolean; error?: string; hideLabel?: boolean }) {
  const { t } = useLocale();
  const [custom, setCustom] = useState(false);
  const preset = presetOf(saved, custom);
  const presets: [Preset, string][] = [
    ["none", t("meetings.noRepeat")], ["weekdays", t("meetings.weekdays")], ["Daily", t("meetings.daily")], ["Weekly", t("meetings.weekly")],
    ["Monthly", t("meetings.monthly")], ["Yearly", t("meetings.yearly")], ["custom", preset === "custom" && saved ? recurrenceSummary(saved, t) : t("meetings.custom")],
  ];
  const makeRule = (key: Preset): RecurrenceRule => ({
    frequency: key === "weekdays" || key === "custom" ? "Weekly" : key as Frequency, interval: 1,
    weekdays: key === "weekdays" ? weekdays.slice(0, 5) : key === "Weekly" || key === "custom" ? [weekdayOf(startDate)] : [],
    until: startDate ? parseDate(startDate.slice(0, 10)).add({ months: 1 }).toString() : null, count: null,
  });
  const endOf = (rule: RecurrenceRule) => rule.until ?? (rule.count !== null ? recurrenceDates(startDate, rule).at(-1) ?? "" : "");
  return (
    <div>
      <MeetingSelect label={t("meetings.recurrence")} hideLabel={hideLabel} value={preset} disabled={disabled} options={presets} onChange={key => {
        if (key === "custom") { setCustom(true); commit(saved ?? makeRule("custom")); return; }
        setCustom(false);
        commit(key === "none" ? null : makeRule(key as Preset));
      }} />
      <RecurrenceDetails>
        {saved && (preset === "custom"
          ? <section aria-label={t("meetings.custom")} className="rounded-xl border border-separator bg-surface-secondary p-4"><RecurrenceControls value={saved} startDate={startDate} onChange={commit} disabled={disabled} /></section>
          : <MeetingDateField label={t("meetings.repeatEnd")} allDay value={endOf(saved)} minDate={startDate.slice(0, 10)} isDisabled={disabled} onChange={until => commit({ ...saved, count: null, until: until || null })} />)}
      </RecurrenceDetails>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
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
  return (
    <div className="meeting-recurrence-details" style={{ height: height ?? undefined }}>
      <div ref={content} className="flow-root">{children && <div className="pt-3">{children}</div>}</div>
    </div>
  );
}

function RecurrenceControls({ value, startDate, onChange, disabled }: { value: RecurrenceRule; startDate: string; onChange: (rule: RecurrenceRule) => void; disabled?: boolean }) {
  const { t } = useLocale();
  // What is typed, kept while the field is being edited (empty, or "1" on the way to "12"); the rule takes valid numbers.
  const [interval, setIntervalText] = useState(String(value.interval));
  const dates = value.until ? recurrenceDates(startDate, value) : [];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField value={interval} isDisabled={disabled} onChange={text => {
          setIntervalText(text);
          const number = Number(text);
          if (text !== "" && Number.isInteger(number) && number >= 1) onChange({ ...value, interval: number });
        }} onBlur={() => setIntervalText(String(value.interval))}>
          <Label>{t("meetings.repeatEvery")}</Label><Input type="number" min={1} max={366} />
        </TextField>
        <MeetingSelect label={t("meetings.unit")} value={value.frequency} disabled={disabled}
          options={[["Daily", t("meetings.day")], ["Weekly", t("meetings.week")], ["Monthly", t("meetings.month")], ["Yearly", t("meetings.year")]]}
          onChange={key => onChange({ ...value, frequency: key as Frequency, weekdays: key === "Weekly" ? [weekdayOf(startDate)] : [] })} />
      </div>
      {value.frequency === "Weekly" && <WeekdayChips label={t("meetings.repeatWeekdays")} value={value.weekdays} onChange={days => onChange({ ...value, weekdays: days })} disabled={disabled} />}
      <MeetingDateField label={t("meetings.repeatEnd")} allDay value={value.until ?? (value.count !== null ? recurrenceDates(startDate, value).at(-1) ?? "" : "")}
        minDate={startDate.slice(0, 10)} isDisabled={disabled} onChange={until => onChange({ ...value, count: null, until: until || null })} />
      <p className="text-xs text-muted">
        {recurrenceSummary(value, t)}{" "}
        {value.until && (dates.length > 366 ? t("meetings.estimateMore") : t("meetings.estimate").replace("{count}", String(dates.length)))}{" "}
        {t("meetings.maxOccurrences")}
      </p>
    </div>
  );
}
