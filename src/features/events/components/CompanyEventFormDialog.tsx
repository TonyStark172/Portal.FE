"use client";

import { useMemo, useRef, useState } from "react";
import { MapPin } from "@gravity-ui/icons";
import { Button, Input, Label, Modal, Radio, RadioGroup, Switch, TextArea, TextField, toast } from "@heroui/react";
import { MeetingDateField } from "@/features/meetings/components/MeetingDateField";
import { MeetingSelect } from "@/features/meetings/components/MeetingRecurrenceEditor";
import { allDayRange } from "@/features/meetings/meetingForm";
import { meetingProblem, type MeetingProblem } from "@/features/meetings/meetingsClient";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { eventLimits, toCompanyEventWriteRequest, validateCompanyEventForm } from "../eventForm";
import { locationLink } from "../eventLocation";
import { useEventsClient } from "../eventsClient";
import { eventCategories, type CompanyEvent, type CompanyEventFormValue, type EventAudience } from "../eventTypes";
import { categoryLabel } from "./CompanyEventDetailsDialog";
import { EventDepartmentPicker } from "./EventDepartmentPicker";

/** The form fields a server's validation message may name (its property, last segment, lower case). */
const serverFields: Record<string, string> = {
  title: "title", location: "location", description: "description", category: "category",
  startutc: "start", endutc: "end", departmentids: "departments",
};

/**
 * Adds or edits a company event (`initial`, null: closed): its name and category, when (a time or whole days), where,
 * a description and who it is for (the whole company or some departments). `session` starts the form afresh.
 */
export function CompanyEventFormDialog({ initial, session, onClose, onSaved }: {
  initial: CompanyEventFormValue | null;
  session: number;
  onClose: () => void;
  onSaved: (event: CompanyEvent) => void;
}) {
  const { t } = useLocale();
  const [saving, setSaving] = useState(false);
  return (
    <Modal.Backdrop isOpen={initial !== null} onOpenChange={open => { if (!open && !saving) onClose(); }} isDismissable={!saving} isKeyboardDismissDisabled={saving}>
      <Modal.Container size="lg" placement="center" scroll="inside">
        <Modal.Dialog className="event-form-dialog">
          {!saving && <Modal.CloseTrigger aria-label={t("meetings.close")} />}
          <Modal.Header><Modal.Heading>{initial?.editing ? t("events.edit") : t("events.new")}</Modal.Heading></Modal.Header>
          {initial && <EventForm key={session} initial={initial} onSaving={setSaving} onCancel={onClose} onSaved={onSaved} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function EventForm({ initial, onSaving, onCancel, onSaved }: {
  initial: CompanyEventFormValue; onSaving: (saving: boolean) => void; onCancel: () => void; onSaved: (event: CompanyEvent) => void;
}) {
  const { t } = useLocale();
  const client = useEventsClient();
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<MeetingProblem | null>(null);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  // The times a timed event had, to come back to when "all day" is turned off again.
  const timed = useRef({ start: initial.isAllDay ? `${initial.start}T09:00` : initial.start, end: initial.isAllDay ? `${initial.end}T10:00` : initial.end });
  const update = (patch: Partial<CompanyEventFormValue>) => setValue(old => ({ ...old, ...patch }));
  const serverErrors = useMemo(() => {
    const found: Record<string, string> = {};
    for (const [key, messages] of Object.entries(problem?.errors ?? {})) {
      const field = serverFields[key.toLowerCase().split(".").at(-1) ?? ""];
      if (field && messages[0]) found[field] ??= messages[0];
    }
    return found;
  }, [problem]);
  const fieldError = (field: string) => errors[field] ?? serverErrors[field];
  // A problem none of the fields shows (a refusal, a missing event) is said under the form.
  const generalProblem = problem && !Object.keys(serverErrors).length ? problem.detail ?? t("events.saveFailed") : null;
  const categories = useMemo<[string, string][]>(() => eventCategories.map(category => [category, categoryLabel(category, t)]), [t]);

  const submit = async () => {
    if (lock.current) return;
    const found = validateCompanyEventForm(value, t);
    setErrors(found);
    if (Object.keys(found).length) return;
    lock.current = true;
    setSaving(true);
    onSaving(true);
    setProblem(null);
    try {
      const request = toCompanyEventWriteRequest(value);
      const saved = value.editing ? await client.update(value.editing.id, request) : await client.create(request);
      onSaved(saved);
    } catch (failure) {
      const found = meetingProblem(failure);
      if (found.status === 401) return;
      if ([400, 403, 404, 409, 422].includes(found.status)) setProblem(found);
      else toast.danger(found.detail ?? t("events.saveFailed"));
    } finally {
      lock.current = false;
      setSaving(false);
      onSaving(false);
    }
  };

  // A place pasted as a link is named under the field, so that one sees it was recognised.
  const place = locationLink(value.location);
  const text = (field: "title" | "location", label: string, required = false, placeholder?: string) => (
    <div>
      <TextField isDisabled={saving} isRequired={required} isInvalid={!!fieldError(field)} value={value[field]} onChange={next => update({ [field]: next })}>
        <Label>{label}</Label><Input spellCheck={false} maxLength={eventLimits[field]} placeholder={placeholder} />
      </TextField>
      {field === "location" && place?.isLink && (
        <p className="event-location-link mt-1 flex min-w-0 items-center gap-1 text-xs text-muted">
          <MapPin aria-hidden className="size-3.5 shrink-0" /><span className="sr-only">{t("events.locationLinkRecognised")}: </span><span className="truncate">{place.label}</span>
        </p>
      )}
      {fieldError(field) && <p className="mt-1 text-xs text-danger">{fieldError(field)}</p>}
    </div>
  );
  return (
    <>
      <Modal.Body className="event-form-body">
        <div className="grid gap-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <h3 className="text-sm font-semibold sm:col-span-2">{t("events.info")}</h3>
            <div className="sm:col-span-2">{text("title", t("events.name"), true)}</div>
            <MeetingSelect label={t("events.category")} value={value.category} disabled={saving} options={categories}
              onChange={category => update({ category: category as CompanyEventFormValue["category"] })} />
            {text("location", t("events.location"), false, t("events.locationPlaceholder"))}
            <div className="sm:col-span-2">
              <TextField isDisabled={saving} isInvalid={!!fieldError("description")} value={value.description} onChange={description => update({ description })}>
                <Label>{t("events.description")}</Label><TextArea rows={3} maxLength={eventLimits.description} />
              </TextField>
              {fieldError("description") && <p className="mt-1 text-xs text-danger">{fieldError("description")}</p>}
            </div>
          </section>
          <section aria-label={t("meetings.time")} className="min-w-0 space-y-4 border-t border-separator pt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{t("meetings.time")}</h3>
              <Switch size="sm" isSelected={value.isAllDay} isDisabled={saving} onChange={isAllDay => {
                if (isAllDay) { timed.current = { start: value.start, end: value.end }; update({ isAllDay, ...allDayRange(value.start, value.end) }); }
                else update({ isAllDay, start: `${value.start.slice(0, 10)}T${timed.current.start.split("T")[1] ?? "09:00"}`, end: `${value.end.slice(0, 10)}T${timed.current.end.split("T")[1] ?? "10:00"}` });
              }}>
                <Switch.Content><Switch.Control><Switch.Thumb /></Switch.Control><Label>{t("meetings.allDay")}</Label></Switch.Content>
              </Switch>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MeetingDateField label={t("meetings.start")} value={value.start} allDay={value.isAllDay} isDisabled={saving} error={fieldError("start")} onChange={start => update({ start })} />
              <MeetingDateField label={t("meetings.end")} value={value.end} allDay={value.isAllDay} isDisabled={saving} error={fieldError("end")} onChange={end => update({ end })} />
            </div>
            {value.isAllDay && <p className="text-xs text-muted">{t("meetings.endIncludesDay")}</p>}
          </section>
          <section className="min-w-0 space-y-3 border-t border-separator pt-5">
            <RadioGroup value={value.audience} isDisabled={saving} orientation="horizontal" onChange={audience => update({ audience: audience as EventAudience })}>
              <Label className="text-sm font-semibold">{t("events.audience")}</Label>
              {(["company", "departments"] as const).map(audience => (
                <Radio key={audience} value={audience}>
                  <Radio.Content><Radio.Control><Radio.Indicator /></Radio.Control>{t(audience === "company" ? "events.wholeCompany" : "events.chosenDepartments")}</Radio.Content>
                </Radio>
              ))}
            </RadioGroup>
            {value.audience === "departments" && <>
              <EventDepartmentPicker value={value.departmentIds} known={initial.editing?.departments ?? []} disabled={saving} invalid={!!fieldError("departments")}
                onChange={departmentIds => update({ departmentIds })} />
              <p className="text-xs text-muted">{t("events.audienceHint")}</p>
            </>}
            {fieldError("departments") && <p className="text-xs text-danger">{fieldError("departments")}</p>}
          </section>
        </div>
        {generalProblem && <p role="alert" className="mt-3 text-sm text-danger">{generalProblem}</p>}
      </Modal.Body>
      <Modal.Footer className="border-t border-separator pt-4">
        <Button variant="tertiary" isDisabled={saving} onPress={onCancel}>{t("meetings.cancel")}</Button>
        <Button isDisabled={saving} onPress={() => void submit()}>{saving ? t("meetings.saving") : initial.editing ? t("meetings.save") : t("events.create")}</Button>
      </Modal.Footer>
    </>
  );
}
