import "@/app/globals.css";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import type { Meeting } from "../meetingTypes";
import { DayMeetingsDialog } from "./DayMeetingsDialog";

test("the day's title reads as a date, not as a technical key", async () => {
  const screen = await render(<DayMeetingsDialog group={{ key: "2026-10-11", day: "2026-10-11", startUtc: "2026-10-10T17:00:00Z", endUtc: "2026-10-11T17:00:00Z", items: [] }} now={Date.parse("2026-10-11T03:00:00Z")} onClose={() => {}} onOpen={() => {}} />);

  const heading = screen.getByRole("heading");
  await expect.element(heading).toHaveTextContent("11/10/2026");
  await expect.element(heading).toHaveTextContent(/chủ nhật/i);
  await expect.element(heading).not.toHaveTextContent("2026-10-11");
});

test("each meeting of the day shows its state: finished ones faded and struck through, ongoing ones tagged", async () => {
  const meeting = (id: number, title: string, from: string, to: string, isAllDay = false): Meeting => ({
    id, title, kindId: 1, kind: "Nội bộ", location: "501", organizerId: 2, participantCount: 3, status: "Scheduled", color: "#AB3030",
    startUtc: from, endUtc: to, isAllDay, isException: false, version: 1, seriesSchedule: null,
  });
  const items = [
    meeting(1, "Giao ban", "2026-10-11T01:00:00Z", "2026-10-11T02:00:00Z"),
    meeting(2, "Phỏng vấn", "2026-10-11T02:30:00Z", "2026-10-11T03:30:00Z"),
    meeting(3, "Tổng kết", "2026-10-11T07:00:00Z", "2026-10-11T08:00:00Z"),
    meeting(4, "Hội thảo", "2026-10-10T17:00:00Z", "2026-10-11T17:00:00Z", true),
  ];
  const screen = await render(<DayMeetingsDialog group={{ key: "2026-10-11", day: "2026-10-11", startUtc: "2026-10-10T17:00:00Z", endUtc: "2026-10-11T17:00:00Z", items }}
    now={Date.parse("2026-10-11T03:00:00Z")} onClose={() => {}} onOpen={() => {}} />);

  const over = screen.getByRole("button", { name: /Giao ban/ });
  await expect.element(over).toHaveAccessibleName(/\(đã kết thúc\)/);
  const title = over.element().querySelector(".meeting-row-title")!;
  expect(getComputedStyle(title).textDecorationLine).toContain("line-through");
  expect(Number(getComputedStyle(over.element()).opacity)).toBeCloseTo(0.5, 1);
  for (const name of [/Phỏng vấn/, /Hội thảo/]) await expect.element(screen.getByRole("button", { name })).toHaveAccessibleName(/Đang họp/);
  const later = screen.getByRole("button", { name: /Tổng kết/ });
  await expect.element(later).not.toHaveAccessibleName(/Đang họp|đã kết thúc/);
  expect(Number(getComputedStyle(later.element()).opacity)).toBe(1);
});
