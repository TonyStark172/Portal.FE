import "@/app/globals.css";
import { Provider } from "react-redux";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { DayMeetingsDialog } from "@/features/meetings/components/DayMeetingsDialog";
import type { CompanyEvent } from "../eventTypes";
import { EventsSidebarSection } from "./EventsSidebarSection";

const mapsLink = "https://www.google.com/maps/place/Nh%C3%A0+h%C3%A1t+L%E1%BB%9Bn/@21.0242,105.8574,17z/data=!3m1!4b1!4m6!3m5";
const event = (id: number, location: string | null): CompanyEvent => ({
  id, title: `Sự kiện ${id}`, description: null, location, startUtc: "2030-01-07T02:00:00Z", endUtc: "2030-01-07T04:00:00Z", isAllDay: false,
  category: "Training", departments: [], createdById: 1, canManage: false,
});
const events = [event(1, mapsLink), event(2, "Hội trường")];

test("a sidebar row names an event's map link, never shows it whole; the search finds the name", async () => {
  const screen = await render(<Provider store={makeStore()}>
    <EventsSidebarSection events={events} occasions={[]} search="" now={Date.parse("2026-10-14T03:00:00Z")} onOpenEvent={vi.fn()} onOpenOccasion={vi.fn()} />
  </Provider>);
  const rows = screen.getByRole("listitem");
  await expect.element(rows.first()).toHaveTextContent("· Google Maps");
  await expect.element(rows.nth(1)).toHaveTextContent("· Hội trường");
  expect(screen.container.textContent).not.toContain("/maps/place");

  await screen.rerender(<Provider store={makeStore()}>
    <EventsSidebarSection events={events} occasions={[]} search="google maps" now={Date.parse("2026-10-14T03:00:00Z")} onOpenEvent={vi.fn()} onOpenOccasion={vi.fn()} />
  </Provider>);
  await vi.waitFor(() => expect(screen.container.querySelectorAll("li")).toHaveLength(1));
  expect(screen.container.querySelector("li")!.textContent).toContain("Sự kiện 1");
});

test("a day's list names an event's map link, never shows it whole", async () => {
  await render(<Provider store={makeStore()}>
    <DayMeetingsDialog group={{ key: "day", day: "2030-01-07", startUtc: "2030-01-06T17:00:00Z", endUtc: "2030-01-07T17:00:00Z", items: [], events }} now={Date.parse("2026-10-14T03:00:00Z")} onClose={vi.fn()} onOpen={vi.fn()} />
  </Provider>);
  const dialog = () => document.querySelector<HTMLElement>("[role=dialog]");
  await vi.waitFor(() => expect(dialog()?.textContent).toContain("Google Maps"));
  expect(dialog()!.textContent).toContain("Hội trường");
  expect(dialog()!.textContent).not.toContain("/maps/place");
});
