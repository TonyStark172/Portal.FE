"use client";
import { useMemo, useRef, useState } from "react";
import { Button, Checkbox, Input, Label, Modal, Switch, TextField } from "@heroui/react";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { allDayRange, changeEditScope, editScopeOf, reanchorRecurrence, validateMeetingForm } from "../meetingForm";
import type { MeetingProblem } from "../meetingsClient";
import type { EditScope, MeetingFormValue } from "../meetingTypes";
import { MeetingAudiencePicker } from "./MeetingAudiencePicker";
import { MeetingConflictList } from "./MeetingConflictList";
import { MeetingDateField } from "./MeetingDateField";
import { MeetingRecurrenceEditor, MeetingSelect } from "./MeetingRecurrenceEditor";

export type MeetingFormKind = { id: number; name: string; isActive: boolean };

export function MeetingForm({ initial, kinds, isSaving, onSubmit, onCancel, problem, onReload }: { initial: MeetingFormValue; kinds: MeetingFormKind[]; isSaving: boolean; onSubmit: (value: MeetingFormValue) => void; onCancel: () => void; problem: MeetingProblem | null; onReload?: () => void }) {
  const { t } = useLocale();
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [audienceBusy, setAudienceBusy] = useState(false);
  const timed = useRef({ start: initial.isAllDay ? `${initial.start}T09:00` : initial.start, end: initial.isAllDay ? `${initial.end}T10:00` : initial.end });
  // The catalog may arrive after a new form opened: until a kind is chosen, the first active one is the default.
  const kindId = value.kindId ?? (initial.editing ? null : kinds.find(kind => kind.isActive)?.id ?? null);
  const update = (patch: Partial<MeetingFormValue>) => setValue(old => ({ ...old, ...patch }));
  const submit = () => {
    if (isSaving || audienceBusy) return;
    const submitted = { ...value, kindId };
    const next = validateMeetingForm(submitted, t);
    setErrors(next);
    if (!Object.keys(next).length) onSubmit(submitted);
  };
  const series = !!initial.editing?.seriesId;
  const scope = editScopeOf(value);
  const fieldError = (field: string) => errors[field] ?? Object.entries(problem?.errors ?? {}).find(([key]) => key.toLowerCase().split(".").at(-1) === field.toLowerCase())?.[1]?.[0];
  const remaining = value.recurrence?.count != null ? Math.max(0, value.recurrence.count - (initial.editing?.occurrenceKey ?? 0)) : null;
  // Hidden kinds cannot be picked for a new booking, but a meeting that already has one keeps it (marked as hidden).
  const kindOptions = useMemo<[string, string][]>(() => kinds
    .filter(kind => kind.isActive || kind.id === kindId)
    .map(kind => [String(kind.id), kind.isActive ? kind.name : t("meetings.kindHidden").replace("{name}", kind.name)]), [kinds, kindId, t]);
  const textField = (field: "title" | "location", label: string, max: number) => (
    <div className={field === "title" ? "sm:col-span-2" : undefined}>
      <TextField isDisabled={isSaving} isRequired isInvalid={!!fieldError(field)} value={value[field]} onChange={text => update({ [field]: text })}>
        <Label>{label}</Label><Input spellCheck={false} maxLength={max} />
      </TextField>
      {fieldError(field) && <p className="mt-1 text-xs text-danger">{fieldError(field)}</p>}
    </div>
  );
  return (
    <>
      <Modal.Body className="meeting-form-body">
        <div className="grid gap-5">
          <section className="order-1 grid gap-3 sm:grid-cols-2">
            <h3 className="text-sm font-semibold sm:col-span-2">{t("meetings.info")}</h3>
            {textField("title", t("meetings.name"), 200)}
            <div>
              <MeetingSelect label={t("meetings.type")} value={kindId === null ? "" : String(kindId)} disabled={isSaving} options={kindOptions}
                onChange={key => update({ kindId: Number(key) })} />
              {fieldError("kindId") && <p className="mt-1 text-xs text-danger">{fieldError("kindId")}</p>}
            </div>
            {textField("location", t("meetings.location"), 200)}
          </section>
          <section className="order-2 min-w-0 space-y-3">
            <MeetingAudiencePicker selection={value.audience} disabled={isSaving} onBusyChange={setAudienceBusy} onChange={audience => update({ audience })} />
          </section>
          <div className="order-3 grid items-stretch gap-5 border-t border-separator pt-5 md:grid-cols-2">
            <section aria-label={t("meetings.time")} className="min-w-0 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{t("meetings.time")}</h3>
                <Switch size="sm" isSelected={value.isAllDay} isDisabled={isSaving} onChange={isAllDay => {
                  if (isAllDay) { timed.current = { start: value.start, end: value.end }; update({ isAllDay, ...allDayRange(value.start, value.end) }); }
                  else update({ isAllDay, start: `${value.start.slice(0, 10)}T${timed.current.start.split("T")[1] ?? "09:00"}`, end: `${value.end.slice(0, 10)}T${timed.current.end.split("T")[1] ?? "10:00"}` });
                }}>
                  <Switch.Content><Switch.Control><Switch.Thumb /></Switch.Control><Label>{t("meetings.allDay")}</Label></Switch.Content>
                </Switch>
              </div>
              <div className="grid gap-3">
                <MeetingDateField label={t("meetings.start")} value={value.start} allDay={value.isAllDay} isDisabled={isSaving} error={fieldError("start")}
                  onChange={start => setValue(old => ({ ...old, start, recurrence: reanchorRecurrence(old.recurrence, old.start, start) }))} />
                <MeetingDateField label={t("meetings.end")} value={value.end} allDay={value.isAllDay} isDisabled={isSaving} error={fieldError("end")} onChange={end => update({ end })} />
              </div>
              {value.isAllDay && <p className="text-xs text-muted">{t("meetings.endIncludesDay")}</p>}
            </section>
            <section aria-label={t("meetings.recurrence")} className="min-w-0 space-y-4 md:border-l md:border-separator md:pl-5">
              <h3 className="text-sm font-semibold">{t("meetings.recurrence")}</h3>
              {series && (
                <MeetingSelect label={t("meetings.scopeLabel")} value={value.scope} disabled={isSaving}
                  options={[["Occurrence", t("meetings.scopeOccurrence")], ["Following", t("meetings.scopeFollowing")], ["Series", t("meetings.scopeSeries")]]}
                  onChange={next => setValue(old => changeEditScope(old, next as EditScope))} />
              )}
              {series && scope === "Occurrence"
                ? <p className="text-xs text-muted">{t("meetings.occurrenceOnlyHint")}</p>
                : <MeetingRecurrenceEditor hideLabel value={value.recurrence} startDate={value.start} onChange={recurrence => update({ recurrence })} disabled={isSaving} error={fieldError("recurrence")} />}
              {series && scope !== "Occurrence" && (
                <p className="text-xs text-muted">
                  {t("meetings.seriesHint")}
                  {scope === "Following" && remaining !== null && ` ${t("meetings.followingCountHint").replace("{count}", String(remaining))}`}
                </p>
              )}
              {series && scope !== "Occurrence" && (
                <Checkbox isDisabled={isSaving} isSelected={value.replaceExceptions} onChange={replaceExceptions => update({ replaceExceptions })}>
                  <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>{t("meetings.replaceExceptions")}</Checkbox.Content>
                </Checkbox>
              )}
            </section>
          </div>
        </div>
        {problem && (
          <div className="mt-3">
            <MeetingConflictList problem={problem} />
            {problem.code === "staleVersion" && <Button variant="secondary" size="sm" className="mt-2" isDisabled={isSaving} onPress={onReload}>{t("meetings.reloadDraft")}</Button>}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer className="border-t border-separator pt-4">
        <Button variant="tertiary" isDisabled={isSaving} onPress={onCancel}>{t("meetings.cancel")}</Button>
        <Button isDisabled={isSaving || audienceBusy} onPress={submit}>{isSaving ? t("meetings.saving") : initial.editing ? t("meetings.save") : t("meetings.create")}</Button>
      </Modal.Footer>
    </>
  );
}
