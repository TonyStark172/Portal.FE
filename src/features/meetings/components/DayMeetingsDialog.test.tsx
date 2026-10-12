import "@/app/globals.css";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { DayMeetingsDialog } from "./DayMeetingsDialog";

test("the day's title reads as a date, not as a technical key", async () => {
  const screen = await render(<DayMeetingsDialog group={{ key: "2026-10-11", day: "2026-10-11", startUtc: "2026-10-10T17:00:00Z", endUtc: "2026-10-11T17:00:00Z", items: [] }} onClose={() => {}} onOpen={() => {}} />);

  const heading = screen.getByRole("heading");
  await expect.element(heading).toHaveTextContent("11/10/2026");
  await expect.element(heading).toHaveTextContent(/chủ nhật/i);
  await expect.element(heading).not.toHaveTextContent("2026-10-11");
});
