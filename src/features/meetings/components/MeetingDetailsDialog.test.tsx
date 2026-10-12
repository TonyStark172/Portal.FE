import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { signedIn } from "@/shared/session/sessionSlice";
import type { Meeting } from "../meetingTypes";
import { MeetingDetailsDialog } from "./MeetingDetailsDialog";

const meeting: Meeting = {
  id: 7, title: "Giao ban", kind: "Nội bộ", location: "501", organizerId: 2, participantCount: 45, status: "Scheduled",
  startUtc: "2030-01-07T02:00:00Z", endUtc: "2030-01-07T03:00:00Z", isAllDay: false, isException: false, version: 4,
  seriesId: 9, seriesVersion: 3, occurrenceKey: 1, seriesSchedule: null,
};
const person = (userId: number) => ({ userId, fullName: `Người ${userId}`, employeeCode: null, avatarUrl: null, positionName: null });
const requestOf = (input: RequestInfo | URL) => input instanceof Request ? input : new Request(new URL(String(input), location.href));

async function show(userId: number, onCanceled = vi.fn()) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  const screen = await render(<Provider store={store}>
    <MeetingDetailsDialog meeting={meeting} userId={userId} busy={false} onClose={vi.fn()} onEdit={vi.fn()} onCanceled={onCanceled} />
  </Provider>);
  return { screen, onCanceled };
}

afterEach(() => vi.restoreAllMocks());

test("lists who is invited a page at a time", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async input => {
    const url = new URL(requestOf(input).url);
    const page = Number(url.searchParams.get("pageNumber") ?? 1);
    const ids = Array.from({ length: page === 1 ? 20 : 20 }, (_, i) => (page - 1) * 20 + i + 1);
    return Response.json({ items: ids.map(person), totalCount: 45, missingEmailCount: 0, pageNumber: page });
  });

  const { screen } = await show(2);

  await expect.element(screen.getByText("Người 20")).toBeVisible();
  expect(document.body.textContent).not.toContain("Người 21");
  await userEvent.click(screen.getByRole("button", { name: "Xem thêm (25)" }));
  await expect.element(screen.getByText("Người 40")).toBeVisible();
});

test("the organizer cancels one occurrence of a series after confirming", async () => {
  const deletes: URL[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async input => {
    const request = requestOf(input);
    if (request.method === "DELETE") {
      deletes.push(new URL(request.url));
      return Response.json({ anchorMeetingId: 7, mutationId: "m", affectedCount: 1, version: 5, seriesVersion: 4 });
    }
    return Response.json({ items: [person(3)], totalCount: 1, missingEmailCount: 0, pageNumber: 1 });
  });
  const { screen, onCanceled } = await show(2);

  await userEvent.click(screen.getByRole("button", { name: "Hủy cuộc họp" }));
  expect(deletes).toHaveLength(0);
  await expect.element(screen.getByText("Hủy cuộc họp này?")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Xác nhận hủy" }));

  await vi.waitFor(() => expect(onCanceled).toHaveBeenCalled());
  expect(deletes).toHaveLength(1);
  expect(deletes[0].pathname).toBe("/backend/api/Meetings/7");
  expect(Object.fromEntries(deletes[0].searchParams)).toMatchObject({ scope: "Occurrence", expectedVersion: "4", expectedSeriesVersion: "3" });
  expect(deletes[0].searchParams.get("mutationId")).toMatch(/^[0-9a-f-]{36}$/);
});

test("someone other than the organizer can neither cancel nor edit", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: [], totalCount: 0, missingEmailCount: 0, pageNumber: 1 }));

  const { screen } = await show(5);

  await expect.element(screen.getByText("Giao ban")).toBeVisible();
  expect(screen.getByRole("button", { name: "Hủy cuộc họp" }).query()).toBeNull();
  expect(screen.getByRole("button", { name: "Chỉnh sửa cuộc họp" }).query()).toBeNull();
});
