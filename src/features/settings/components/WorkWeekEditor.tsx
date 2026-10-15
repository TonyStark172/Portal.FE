"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Button, Disclosure, ListBox, Select } from "@heroui/react";
// Straight from their modules, not the meetings feature's index: that one brings the whole calendar along.
import { MeetingSelect } from "@/features/meetings/components/MeetingRecurrenceEditor";
import { WeekdayChips } from "@/features/meetings/components/WeekdayChips";
import { weekdays } from "@/features/meetings/meetingForm";
import { meetingProblem, useMeetingsClient } from "@/features/meetings/meetingsClient";
import type { Weekday } from "@/features/meetings/meetingTypes";
import { fromWorkWeekForm, summarizeWorkWeek, toWorkWeekForm, validateWorkWeekForm, type WorkWeekForm } from "@/features/meetings/workWeek";
import { useLocale } from "@/shared/i18n";

const dayKeys = ["meetings.dayMon", "meetings.dayTue", "meetings.dayWed", "meetings.dayThu", "meetings.dayFri", "meetings.daySat", "meetings.daySun"];
/** Every quarter hour of the day, "00:00".."23:45". */
const quarterHours = Array.from({ length: 96 }, (_, index) =>
  `${String(Math.floor(index / 4)).padStart(2, "0")}:${String(index % 4 * 15).padStart(2, "0")}`);
/** The quarter hours, plus the current value when it is not one (a time saved some other way stays as it is). */
const timeOptions = (value: string): [string, string][] =>
  (quarterHours.includes(value) ? quarterHours : [...quarterHours, value].sort()).map(time => [time, time]);

/**
 * When the organization works: the working days, the hours they share, and the days with hours of their own. It only
 * shapes the meeting calendar; nothing stops a meeting being booked outside it. `framed` (the default) puts it in its
 * own bordered section under a heading; a dialog that already has both passes `framed={false}`. `summary` (the default)
 * says the week in a few words beside the save; a page that shows the saved week elsewhere passes `summary={false}`.
 */
export function WorkWeekEditor({ framed = true, summary = true }: { framed?: boolean; summary?: boolean }) {
  const { t } = useLocale();
  const client = useMeetingsClient();
  const [form, setForm] = useState<WorkWeekForm | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    const controller = new AbortController();
    client.workWeek(controller.signal).then(
      week => setForm(toWorkWeekForm(week.days)),
      () => { if (!controller.signal.aborted) setLoadFailed(true); });
    return () => controller.abort();
  }, [client]);

  const labelOf = (day: Weekday) => t(dayKeys[weekdays.indexOf(day)]);
  const saving = status === "saving";

  if (!form) {
    return <Section framed={framed}>{loadFailed
      ? <p role="alert" className="text-sm text-danger">{t("settings.meetings.workWeekLoadFailed")}</p>
      : <p className="text-sm text-muted">{t("settings.meetings.loading")}</p>}</Section>;
  }

  const change = (next: WorkWeekForm) => { setForm(next); setError(null); setStatus("idle"); };
  const setDays = (days: Weekday[]) =>
    // A day that stops working loses its own hours.
    change({ ...form, days, overrides: Object.fromEntries(Object.entries(form.overrides).filter(([day]) => days.includes(day as Weekday))) });
  const setOverride = (day: Weekday, hours: { start: string; end: string } | null) => {
    const overrides = { ...form.overrides };
    if (hours) overrides[day] = hours; else delete overrides[day];
    change({ ...form, overrides });
  };
  const withHours = form.days.filter(day => form.overrides[day]);
  const withoutHours = form.days.filter(day => !form.overrides[day]);

  const save = async () => {
    const invalid = validateWorkWeekForm(form, t);
    if (invalid) { setError(invalid); return; }
    setStatus("saving");
    try {
      await client.updateWorkWeek(fromWorkWeekForm(form));
      setStatus("saved");
    } catch (failure) {
      const problem = meetingProblem(failure);
      const messages = [...new Set(Object.values(problem.errors ?? {}).flat())];
      setError(messages.length ? messages.join(" ") : problem.detail ?? t("common.genericError"));
      setStatus("idle");
    }
  };

  return (
    <Section framed={framed}>
      {/*
        One row, on the three columns of the organization form above it: the working days across the first two (seven
        chips need more than one), the two hours sharing the third, filled like the fields there; each under its name,
        the chips level with the fields.
      */}
      <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          {/* Named on screen like the hours; the chips' group already carries the name for screen readers. */}
          <span aria-hidden className="text-sm font-medium">{t("settings.meetings.workDays")}</span>
          <WeekdayChips label={t("settings.meetings.workDays")} value={form.days} onChange={setDays} disabled={saving} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
          <MeetingSelect variant="secondary" label={t("settings.meetings.start")} value={form.start} options={timeOptions(form.start)} disabled={saving}
            onChange={start => change({ ...form, start })} />
          <MeetingSelect variant="secondary" label={t("settings.meetings.end")} value={form.end} options={timeOptions(form.end)} disabled={saving}
            onChange={end => change({ ...form, end })} />
        </div>
      </div>
      <Disclosure>
        <Disclosure.Heading>
          <Button slot="trigger" variant="ghost" size="sm" className="-ms-2">{t("settings.meetings.dayHours")}<Disclosure.Indicator /></Button>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body className="flex flex-col gap-2 pt-2">
            {withHours.length === 0 && <p className="text-sm text-muted">{t("settings.meetings.noDayHours")}</p>}
            {withHours.map(day => {
              const hours = form.overrides[day]!;
              return (
                <div key={day} className="flex flex-wrap items-center gap-2">
                  <span className="w-10 text-sm font-medium">{labelOf(day)}</span>
                  <div className="w-28"><MeetingSelect hideLabel label={`${t("settings.meetings.start")} ${labelOf(day)}`} value={hours.start}
                    options={timeOptions(hours.start)} disabled={saving} onChange={start => setOverride(day, { ...hours, start })} /></div>
                  <div className="w-28"><MeetingSelect hideLabel label={`${t("settings.meetings.end")} ${labelOf(day)}`} value={hours.end}
                    options={timeOptions(hours.end)} disabled={saving} onChange={end => setOverride(day, { ...hours, end })} /></div>
                  <Button size="sm" variant="ghost" isDisabled={saving} aria-label={`${t("settings.meetings.removeDayHours")} ${labelOf(day)}`}
                    onPress={() => setOverride(day, null)}>{t("settings.meetings.removeDayHours")}</Button>
                </div>
              );
            })}
            {withoutHours.length > 0 && (
              <Select className="w-64" aria-label={t("settings.meetings.addDayHours")} placeholder={t("settings.meetings.addDayHours")}
                selectedKey={null} isDisabled={saving}
                onSelectionChange={key => { if (key !== null) setOverride(key as Weekday, { start: form.start, end: form.end }); }}>
                <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                <Select.Popover>
                  <ListBox>{withoutHours.map(day => <ListBox.Item id={day} key={day} textValue={labelOf(day)}>{labelOf(day)}</ListBox.Item>)}</ListBox>
                </Select.Popover>
              </Select>
            )}
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {/* At the right, as on the settings page it sits in: the week in a few words, "saved" once it is, then the button. */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {summary && <p className="text-sm text-muted">{summarizeWorkWeek(fromWorkWeekForm(form), t)}</p>}
        {status === "saved" && <p role="status" className="text-sm text-muted">{t("settings.meetings.saved")}</p>}
        <Button variant="primary" isDisabled={saving} onPress={save}>{saving ? t("settings.meetings.saving") : t("settings.meetings.save")}</Button>
      </div>
    </Section>
  );
}

function Section({ framed, children }: { framed: boolean; children: ReactNode }) {
  const { t } = useLocale();
  const title = useId();
  if (!framed) return <div className="flex flex-col gap-4">{children}</div>;
  return (
    <section aria-labelledby={title} className="flex flex-col gap-4 rounded-2xl border border-separator bg-surface p-5">
      <div>
        <h2 id={title} className="text-lg font-semibold">{t("settings.meetings.workWeek")}</h2>
        <p className="text-sm text-muted">{t("settings.meetings.workWeekHint")}</p>
      </div>
      {children}
    </section>
  );
}
