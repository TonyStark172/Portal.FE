import { expect, test } from "vitest";
import { translate } from "@/shared/i18n/locale";
import { fromCompanyEvent, newCompanyEventForm, toCompanyEventWriteRequest, validateCompanyEventForm } from "./eventForm";
import type { CompanyEvent, CompanyEventFormValue } from "./eventTypes";

const t = (key: string) => translate(key, "vi-VN");
const form = (patch: Partial<CompanyEventFormValue> = {}): CompanyEventFormValue => ({
  title: "Đào tạo an toàn", category: "Training", isAllDay: false, start: "2026-10-21T09:00", end: "2026-10-21T11:00",
  location: "", description: "", audience: "company", departmentIds: [], editing: null, ...patch,
});
const event: CompanyEvent = {
  id: 4, title: "Team building", description: "Đi Vũng Tàu", location: "Vũng Tàu", startUtc: "2026-10-23T17:00:00.000Z",
  endUtc: "2026-10-25T17:00:00.000Z", isAllDay: true, category: "TeamBuilding", departments: [{ id: 3, name: "Kỹ thuật" }],
  createdById: 1, canManage: true,
};

test("a new event starts at the next quarter hour, for an hour, for the whole company", () => {
  const value = newCompanyEventForm(new Date("2026-10-20T02:05:00Z"));
  expect(value).toMatchObject({ title: "", category: "Other", isAllDay: false, start: "2026-10-20T09:15", end: "2026-10-20T10:15", audience: "company", departmentIds: [], editing: null });
});

test("an all-day event is edited by its days, the last one included, and its departments", () => {
  expect(fromCompanyEvent(event)).toMatchObject({
    title: "Team building", category: "TeamBuilding", isAllDay: true, start: "2026-10-24", end: "2026-10-25",
    location: "Vũng Tàu", description: "Đi Vũng Tàu", audience: "departments", departmentIds: [3], editing: event,
  });
  expect(fromCompanyEvent({ ...event, isAllDay: false, startUtc: "2026-10-21T02:00:00Z", endUtc: "2026-10-21T04:30:00Z", departments: [], description: null, location: null }))
    .toMatchObject({ isAllDay: false, start: "2026-10-21T09:00", end: "2026-10-21T11:30", audience: "company", departmentIds: [], description: "", location: "" });
});

test("the write request is in UTC; an all-day event runs from midnight to the midnight after its last day (UTC+7)", () => {
  expect(toCompanyEventWriteRequest(form({ title: "  Đào tạo  ", location: " Hội trường ", description: "  " }))).toEqual({
    title: "Đào tạo", description: null, location: "Hội trường", startUtc: "2026-10-21T02:00:00.000Z", endUtc: "2026-10-21T04:00:00.000Z",
    isAllDay: false, category: "Training", departmentIds: [],
  });
  expect(toCompanyEventWriteRequest(form({ isAllDay: true, start: "2026-10-24", end: "2026-10-25", audience: "departments", departmentIds: [3, 5] }))).toMatchObject({
    startUtc: "2026-10-23T17:00:00.000Z", endUtc: "2026-10-25T17:00:00.000Z", isAllDay: true, departmentIds: [3, 5],
  });
  // The whole company: no departments, whatever was picked before switching.
  expect(toCompanyEventWriteRequest(form({ audience: "company", departmentIds: [3] })).departmentIds).toEqual([]);
});

test("a valid form has no errors", () => {
  expect(validateCompanyEventForm(form(), t)).toEqual({});
  expect(validateCompanyEventForm(form({ isAllDay: true, start: "2026-10-24", end: "2026-10-24" }), t)).toEqual({});
});

test("the title is required, texts have their limits, the end comes after the start, within 31 days", () => {
  const errors = validateCompanyEventForm(form({
    title: "  ", location: "x".repeat(201), description: "x".repeat(2001), end: "2026-10-21T09:00",
  }), t);
  expect(Object.keys(errors).sort()).toEqual(["description", "end", "location", "title"]);
  expect(validateCompanyEventForm(form({ end: "2026-10-21T08:00" }), t).end).toBeTruthy();
  expect(validateCompanyEventForm(form({ isAllDay: true, start: "2026-10-24", end: "2026-10-23" }), t).end).toBeTruthy();
  expect(validateCompanyEventForm(form({ isAllDay: true, start: "2026-10-01", end: "2026-10-31" }), t).end).toBeUndefined();
  expect(validateCompanyEventForm(form({ isAllDay: true, start: "2026-10-01", end: "2026-11-01" }), t).end).toBeTruthy();
  expect(validateCompanyEventForm(form({ start: "" }), t).start).toBeTruthy();
});

test("chosen departments need at least one department", () => {
  expect(validateCompanyEventForm(form({ audience: "departments", departmentIds: [] }), t).departments).toBeTruthy();
  expect(validateCompanyEventForm(form({ audience: "departments", departmentIds: [2] }), t).departments).toBeUndefined();
});
