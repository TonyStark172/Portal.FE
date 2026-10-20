import { addDateDays, businessDate, businessInput, businessUtc } from "@/features/meetings/meetingForm";
import { defaultEventCategory, type CompanyEvent, type CompanyEventFormValue, type CompanyEventWriteRequest } from "./eventTypes";

type Translate = (key: string) => string;

const dayMs = 86400000;
/** How long an event may last (Portal.BE CompanyEvent.MaxDuration). */
const maxDays = 31;
/** As Portal.BE CompanyEvent: a location is long enough for a link pasted from Google Maps. */
export const eventLimits = { title: 200, location: 1000, description: 2000 } as const;

/** A new event: from the next quarter hour, for an hour, for the whole company. */
export function newCompanyEventForm(now = new Date()): CompanyEventFormValue {
  const start = new Date(Math.ceil(now.getTime() / 900000) * 900000);
  return {
    title: "", category: defaultEventCategory, isAllDay: false, start: businessInput(start), end: businessInput(new Date(start.getTime() + 3600000)),
    location: "", description: "", audience: "company", departmentIds: [], editing: null,
  };
}

/** The form for editing `event`: an all-day one by its days (the last one included). */
export function fromCompanyEvent(event: CompanyEvent): CompanyEventFormValue {
  return {
    title: event.title, category: event.category, isAllDay: event.isAllDay,
    start: event.isAllDay ? businessDate(event.startUtc) : businessInput(event.startUtc),
    end: event.isAllDay ? addDateDays(businessInput(event.endUtc), -1) : businessInput(event.endUtc),
    location: event.location ?? "", description: event.description ?? "",
    audience: event.departments.length ? "departments" : "company", departmentIds: event.departments.map(department => department.id),
    editing: event,
  };
}

/** The instants an event's inputs stand for: an all-day one from its first midnight to the one after its last day. */
function instantsOf(value: Pick<CompanyEventFormValue, "start" | "end" | "isAllDay">) {
  const start = businessUtc(value.isAllDay ? value.start.slice(0, 10) : value.start);
  const end = businessUtc(value.isAllDay ? addDateDays(value.end, 1) : value.end);
  return { startUtc: start, endUtc: end };
}

export function toCompanyEventWriteRequest(value: CompanyEventFormValue): CompanyEventWriteRequest {
  return {
    title: value.title.trim(), description: value.description.trim() || null, location: value.location.trim() || null,
    ...instantsOf(value), isAllDay: value.isAllDay, category: value.category,
    departmentIds: value.audience === "departments" ? [...new Set(value.departmentIds)] : [],
  };
}

export function validateCompanyEventForm(value: CompanyEventFormValue, t: Translate): Record<string, string> {
  const errors: Record<string, string> = {};
  const title = value.title.trim();
  if (!title || title.length > eventLimits.title) errors.title = t("meetings.errorRequired").replace("{max}", String(eventLimits.title));
  if (value.location.trim().length > eventLimits.location) errors.location = t("events.errorTooLong").replace("{max}", String(eventLimits.location));
  if (value.description.trim().length > eventLimits.description) errors.description = t("events.errorTooLong").replace("{max}", String(eventLimits.description));
  try {
    const { startUtc, endUtc } = instantsOf(value);
    const length = Date.parse(endUtc) - Date.parse(startUtc);
    if (!(length > 0)) errors.end = t("events.errorEnd");
    else if (length > maxDays * dayMs) errors.end = t("events.errorTooLongEvent").replace("{days}", String(maxDays));
  } catch { errors.start = t("meetings.errorDates"); }
  if (value.audience === "departments" && !value.departmentIds.length) errors.departments = t("events.errorDepartments");
  return errors;
}
