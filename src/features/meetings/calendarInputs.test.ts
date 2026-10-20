import { expect, test } from "vitest";
import { calendarInputs, capacityOf } from "./calendarInputs";
import type { Meeting } from "./meetingTypes";

const meeting = (id: number, hour: number, organizerId = 2): Meeting => ({
  id, title: `Họp ${id}`, kindId: 1, kind: "Nội bộ", location: "501", organizerId, participantCount: 3, status: "Scheduled", color: "#27B450",
  startUtc: new Date(Date.UTC(2026, 9, 12, hour - 7)).toISOString(), endUtc: new Date(Date.UTC(2026, 9, 12, hour - 6)).toISOString(),
  isAllDay: false, isException: false, version: 1, seriesSchedule: null,
});
const more = (count: number) => `+${count}`;

test("a crowded week gives the calendar a few meetings and one '+N' entry per time slot", () => {
  const together = Array.from({ length: 1000 }, (_, i) => meeting(i + 1, 9));

  const inputs = calendarInputs(together, "timeGridWeek", false, 2, more);

  expect(inputs).toHaveLength(4);
  expect(inputs.at(-1)).toMatchObject({ title: "+997", editable: false, classNames: ["meeting-more"] });
  expect(inputs.at(-1)!.extendedProps!.more.items).toHaveLength(997);
});

test("only the organizer may move a meeting", () => {
  const [mine, theirs] = calendarInputs([meeting(1, 9, 2), meeting(2, 11, 3)], "timeGridWeek", false, 2, more);

  expect(mine.editable).toBe(true);
  expect(theirs.editable).toBe(false);
});

test("a month day keeps fewer meetings on a phone", () => {
  const day = Array.from({ length: 8 }, (_, i) => meeting(i + 1, 8 + i));

  expect(calendarInputs(day, "dayGridMonth", false, 2, more)).toHaveLength(5);
  expect(calendarInputs(day, "dayGridMonth", true, 2, more)).toHaveLength(4);
});

test("a month day on a phone keeps three meetings (its dots) and gathers the rest behind '+N'", () => {
  const day = Array.from({ length: 5 }, (_, i) => meeting(i + 1, 8 + i));

  const inputs = calendarInputs(day, "dayGridMonth", true, 2, more);

  expect(inputs).toHaveLength(4);
  expect(inputs.at(-1)).toMatchObject({ title: "+2", classNames: ["meeting-more"] });
  // A dot is tapped to open its day, not dragged.
  expect(inputs.slice(0, 3).every(input => input.editable === false)).toBe(true);
  expect(calendarInputs(day.slice(0, 3), "dayGridMonth", true, 2, more)).toHaveLength(3);
});

test("the calendar shows business time: 09:00 UTC+7 sits at 09:00 on its grid", () => {
  expect(calendarInputs([meeting(1, 9)], "timeGridWeek", false, 2, more)[0].start).toBe("2026-10-12T09:00:00.000Z");
});

test("a month list is a list when crowding meetings", () => {
  expect(capacityOf("listMonth", false)).toEqual(capacityOf("listWeek", false));
});

test("each meeting keeps its own colour, not one of a few tones", () => {
  const [input] = calendarInputs([meeting(1, 9)], "timeGridWeek", false, 2, more);

  expect(input.extendedProps!.color).toBe("#27B450");
  expect(input.classNames ?? []).toEqual([]);
});
