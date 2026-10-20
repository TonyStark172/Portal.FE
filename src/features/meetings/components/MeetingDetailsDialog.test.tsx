import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { hitsAround } from "@/shared/lib/hitArea.testing";
import { signedIn } from "@/shared/session/sessionSlice";
import type { Meeting } from "../meetingTypes";
import { MeetingDetailsDialog } from "./MeetingDetailsDialog";

const meeting: Meeting = {
  id: 7, title: "Giao ban", kindId: 1, kind: "Nội bộ", location: "501", organizerId: 2, participantCount: 45, status: "Scheduled", color: "#7B1FBD",
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

/** The row of faces, named after the people in it. */
const facesRow = (screen: Awaited<ReturnType<typeof show>>["screen"]) => screen.getByRole("img", { name: /^Người tham gia:/ });
const avatarsOf = (row: Element) => [...row.querySelectorAll(":scope > .avatar:not([data-slot='avatar-group-count'])")];

test("the people are one row of faces and nothing to press: no list, no paging", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: Array.from({ length: 20 }, (_, i) => person(i + 1)), totalCount: 45, missingEmailCount: 0, pageNumber: 1 }));
  const { screen } = await show(5);

  const row = facesRow(screen);
  await expect.element(row).toBeVisible();
  // Whose faces they are is read from the row (and its tooltip); the names are not listed below it.
  expect(row.element().getAttribute("aria-label")).toContain("Người 1, Người 2");
  expect(row.element().getAttribute("title")).toContain("Người 1");
  expect(screen.getByText("Người 20", { exact: true }).query()).toBeNull();
  expect(row.element().closest("button")).toBeNull();
  expect(screen.getByRole("button", { name: /Xem thêm/ }).query()).toBeNull();
});

test.each([[1000, 800], [390, 844]])("at %ix%i the people show as one row of faces as wide as there is room, the rest as +N", async (width, height) => {
  await page.viewport(width, height);
  try {
    vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: Array.from({ length: 20 }, (_, i) => person(i + 1)), totalCount: 45, missingEmailCount: 0, pageNumber: 1 }));
    const { screen } = await show(5);
    await expect.element(facesRow(screen)).toBeVisible();
    await new Promise(resolve => setTimeout(resolve, 500));
    const row = facesRow(screen).element();
    const faces = avatarsOf(row);
    const count = row.querySelector("[data-slot='avatar-group-count']")!;
    expect(faces.length).toBeGreaterThan(3);
    expect(count.textContent).toBe(`+${45 - faces.length}`);
    // One line, inside the dialog, and nearly filling it: no room was left for another face.
    const tops = new Set([...faces, count].map(face => Math.round(face.getBoundingClientRect().top)));
    expect(tops.size).toBe(1);
    const room = row.parentElement!.getBoundingClientRect();
    expect(count.getBoundingClientRect().right).toBeLessThanOrEqual(room.right + 1);
    expect(room.right - count.getBoundingClientRect().right).toBeLessThan(48);
  } finally { await page.viewport(1000, 800); }
});

test.each([[1000, 800], [390, 844]])("at %ix%i the faces never show as a bare count, even the moment they arrive", async (width, height) => {
  await page.viewport(width, height);
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: Array.from({ length: 7 }, (_, i) => person(i + 1)), totalCount: 7, missingEmailCount: 0, pageNumber: 1 }));
  // Every state the row is drawn in, as it is drawn.
  const seen: string[] = [];
  const observer = new MutationObserver(() => {
    const row = document.querySelector(".avatar-group");
    if (row) seen.push([...row.children].map(face => face.getAttribute("data-slot") === "avatar-group-count" ? face.textContent : "face").join(","));
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  try {
    const { screen } = await show(5);
    await expect.element(facesRow(screen)).toBeVisible();
    await new Promise(resolve => setTimeout(resolve, 600));
  } finally { observer.disconnect(); await page.viewport(1000, 800); }
  expect(seen.length).toBeGreaterThan(0);
  for (const state of seen) expect(state).toBe(Array(7).fill("face").join(","));
});

test("a few people show every face, with no count", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: [person(1), person(2)], totalCount: 2, missingEmailCount: 0, pageNumber: 1 }));
  const { screen } = await show(5);
  await expect.element(facesRow(screen)).toBeVisible();
  const row = facesRow(screen).element();
  expect(avatarsOf(row)).toHaveLength(2);
  expect(row.querySelector("[data-slot='avatar-group-count']")).toBeNull();
});

test("while the people load, their faces are skeletons, not a spinner", async () => {
  let answer: (response: Response) => void = () => {};
  vi.spyOn(window, "fetch").mockImplementation(() => new Promise<Response>(resolve => { answer = resolve; }));
  const { screen } = await show(5);

  await expect.element(screen.getByRole("heading", { name: "Giao ban" })).toBeVisible();
  const loading = screen.getByRole("status", { name: "Đang tải danh sách người tham gia" });
  await expect.element(loading).toBeVisible();
  expect(loading.element().querySelectorAll(".skeleton").length).toBeGreaterThan(2);
  expect(document.querySelector("[role='dialog'] .spinner")).toBeNull();

  answer(Response.json({ items: [person(1)], totalCount: 1, missingEmailCount: 0, pageNumber: 1 }));
  await expect.element(facesRow(screen)).toBeVisible();
  await expect.element(loading).not.toBeInTheDocument();
});

test("the head count is the people found, once they are, not the calendar's older figure", async () => {
  // The calendar said 45; 13 are invited now.
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: Array.from({ length: 13 }, (_, i) => person(i + 1)), totalCount: 13, missingEmailCount: 0, pageNumber: 1 }));
  const { screen } = await show(5);

  await expect.element(facesRow(screen)).toBeVisible();
  await expect.element(screen.getByText("13 người", { exact: true })).toBeVisible();
  expect(screen.getByText("45 người", { exact: true }).query()).toBeNull();
});

test("a face is the app's avatar: without a picture, the given name's first letter", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: [{ ...person(3), fullName: "Nguyễn Văn An" }], totalCount: 1, missingEmailCount: 0, pageNumber: 1 }));
  const { screen } = await show(5);

  const row = screen.getByRole("img", { name: "Người tham gia: Nguyễn Văn An" });
  await expect.element(row).toBeVisible();
  expect(row.element().querySelector("[data-slot='avatar-fallback']")?.textContent).toBe("A");
  expect(document.body.textContent).not.toContain("@Nguyễn");
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

test.each([[390, false], [1000, true]])("at %ipx the drag-and-drop hint is shown: %s", async (width, shown) => {
  await page.viewport(width, 844);
  try {
    vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: [], totalCount: 0, missingEmailCount: 0, pageNumber: 1 }));
    const { screen } = await show(2);
    await expect.element(screen.getByText("Giao ban")).toBeVisible();
    const hint = screen.getByText(/Bạn có thể kéo\/thả/);
    if (shown) await expect.element(hint).toBeVisible();
    else await expect.element(hint).not.toBeVisible();
  } finally { await page.viewport(1000, 800); }
});

test("reads as the meeting: its title names the dialog, its time is one line, then place, kind and series", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: [], totalCount: 0, missingEmailCount: 0, pageNumber: 1 }));
  const { screen } = await show(5);

  const dialog = screen.getByRole("dialog", { name: "Giao ban" });
  await expect.element(dialog).toBeVisible();
  await expect.element(dialog.getByRole("heading", { name: "Giao ban" })).toBeVisible();
  // 02:00–03:00 UTC is 09:00–10:00 in the company's time, on Monday 7 January 2030.
  const when = dialog.getByText(/09:00 – 10:00/);
  await expect.element(when).toBeVisible();
  expect(when.element().textContent).toMatch(/Thứ Hai/i);
  expect(when.element().textContent).toContain("2030");
  await expect.element(dialog.getByText("501", { exact: true })).toBeVisible();
  await expect.element(dialog.getByText("Nội bộ", { exact: true })).toBeVisible();
  await expect.element(dialog.getByText("Cuộc họp lặp lại")).toBeVisible();
  // No label-and-value pairs any more.
  expect(document.body.textContent).not.toContain("Bắt đầu");
  expect(document.body.textContent).not.toContain("Kết thúc");
});

test("a meeting over several days shows both ends in full", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: [], totalCount: 0, missingEmailCount: 0, pageNumber: 1 }));
  const store = makeStore();
  const screen = await render(<Provider store={store}>
    <MeetingDetailsDialog meeting={{ ...meeting, endUtc: "2030-01-08T03:00:00Z" }} userId={5} busy={false} onClose={vi.fn()} onEdit={vi.fn()} onCanceled={vi.fn()} />
  </Provider>);
  await expect.element(screen.getByText("09:00 07/01/2030 – 10:00 08/01/2030")).toBeVisible();
});

test("the organizer's actions are icons above the title, with no row of buttons below", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: [], totalCount: 0, missingEmailCount: 0, pageNumber: 1 }));
  const { screen } = await show(2);

  const title = screen.getByRole("heading", { name: "Giao ban" });
  await expect.element(title).toBeVisible();
  for (const name of ["Chỉnh sửa cuộc họp", "Hủy cuộc họp", "Đóng"]) {
    const button = screen.getByRole("button", { name, exact: true }).element();
    expect(button.textContent?.trim()).toBe("");
    expect(button.getBoundingClientRect().bottom).toBeLessThanOrEqual(title.element().getBoundingClientRect().top + 1);
  }
  expect(document.querySelector(".modal__footer, .drawer__footer")).toBeNull();
});

test("someone other than the organizer only has the close icon", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: [], totalCount: 0, missingEmailCount: 0, pageNumber: 1 }));
  const { screen } = await show(5);

  await expect.element(screen.getByRole("heading", { name: "Giao ban" })).toBeVisible();
  const buttons = [...screen.getByRole("dialog").element().querySelectorAll("button")].map(button => button.getAttribute("aria-label"));
  expect(buttons).toEqual(["Đóng"]);
  await expect.element(screen.getByText("Chỉ người tổ chức được thay đổi thời gian cuộc họp.")).toBeVisible();
});

test("on a phone the details slide up as a sheet across the bottom of the screen", async () => {
  await page.viewport(390, 844);
  try {
    vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: [], totalCount: 0, missingEmailCount: 0, pageNumber: 1 }));
    const { screen } = await show(2);
    const dialog = screen.getByRole("dialog", { name: "Giao ban" });
    await expect.element(dialog).toBeVisible();
    // Let it finish sliding in.
    await new Promise(resolve => setTimeout(resolve, 500));
    const box = dialog.element().getBoundingClientRect();
    expect(Math.abs(box.bottom - innerHeight)).toBeLessThanOrEqual(1);
    expect(box.width).toBeGreaterThanOrEqual(innerWidth - 1);
    for (const name of ["Chỉnh sửa cuộc họp", "Hủy cuộc họp", "Đóng"]) expect(hitsAround(screen.getByRole("button", { name, exact: true }).element(), 18)).toBe(true);
  } finally { await page.viewport(1000, 800); }
});

test("on a phone the close button takes a tap of at least 40px, though it looks the same size", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: [], totalCount: 0, missingEmailCount: 0, pageNumber: 1 }));
  await page.viewport(390, 844);
  try {
    const { screen } = await show(2);
    const close = screen.getByRole("button", { name: "Đóng" }).first();
    await expect.element(close).toBeVisible();
    await new Promise(resolve => setTimeout(resolve, 400));

    expect(hitsAround(close.element(), 18)).toBe(true);
    expect(close.element().getBoundingClientRect().width).toBeLessThan(40);
  } finally {
    await page.viewport(1000, 800);
  }
});

test("the mark beside the title is in the meeting's own colour", async () => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ items: [], totalCount: 0, missingEmailCount: 0, pageNumber: 1 }));
  await show(5);

  await vi.waitFor(() => expect(document.querySelector(".meeting-swatch")).not.toBeNull());
  // #7B1FBD
  expect(getComputedStyle(document.querySelector(".meeting-swatch")!).backgroundColor).toBe("rgb(123, 31, 189)");
});
