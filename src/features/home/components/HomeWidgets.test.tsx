import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { signedIn } from "@/shared/session/sessionSlice";
import { BirthdaysWidget, MeetingsWidget } from "./HomeWidgets";

const hour = 3600000;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();
const meeting = (id: number, title: string, start: number, end: number) => ({
  id, title, kindId: 1, kind: "Họp", location: `Phòng ${id}`, startUtc: iso(start), endUtc: iso(end), organizerId: 1,
  participantCount: 1, status: "Scheduled", color: "#336699", isAllDay: false, isException: false, version: 1, seriesSchedule: null,
});

/** Portal.BE answering `path` with `body`, or a failure when there is none. */
function serve(path: string, body?: unknown) {
  const calls: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    if (body !== undefined && url.includes(path)) return Response.json(body);
    return new Response(null, { status: 500 });
  });
  return calls;
}

function renderWidget(widget: React.ReactNode) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  return render(<Provider store={store}>{widget}</Provider>);
}

afterEach(() => { vi.restoreAllMocks(); });

test("the meetings widget splits those under way from those to come, and leaves out those over", async () => {
  serve("/api/Meetings", [
    meeting(1, "Đã xong", -3 * hour, -2 * hour),
    meeting(2, "Đang họp giao ban", -hour, hour),
    meeting(3, "Họp sắp tới", 48 * hour, 49 * hour),
  ]);
  const screen = await renderWidget(<MeetingsWidget />);

  await expect.element(screen.getByRole("region", { name: "Đang diễn ra" }).getByText("Đang họp giao ban")).toBeVisible();
  await expect.element(screen.getByRole("region", { name: "Sắp diễn ra" }).getByText("Họp sắp tới")).toBeVisible();
  expect(screen.container.textContent).not.toContain("Đã xong");
  await expect.element(screen.getByRole("link", { name: /Họp sắp tới/ })).toHaveAttribute("href", expect.stringMatching(/^\/meetings\?date=\d{4}-\d{2}-\d{2}$/));
});

test("the meetings widget says so when there are none", async () => {
  serve("/api/Meetings", [meeting(1, "Đã xong", -3 * hour, -2 * hour)]);
  const screen = await renderWidget(<MeetingsWidget />);
  await expect.element(screen.getByText("Không có cuộc họp nào trong 7 ngày tới")).toBeVisible();
});

test("the meetings widget offers a retry when they cannot be loaded", async () => {
  serve("/api/Meetings");
  const screen = await renderWidget(<MeetingsWidget />);
  await expect.element(screen.getByRole("button", { name: "Thử lại" })).toBeVisible();
});

test("the birthdays widget lists the people alone, today's marked out", async () => {
  const today = new Date(Date.now() + 7 * hour).toISOString().slice(0, 10);
  serve("/occasions", [
    { kind: "Holiday", date: today, endDate: today, holiday: "NationalDay" },
    { kind: "Birthday", date: today, userId: 1, fullName: "Nguyễn Văn An", avatarUrl: null, departmentName: "Phòng CNTT" },
    { kind: "Birthday", date: "2099-12-25", userId: 2, fullName: "An Thị Phương", avatarUrl: null, departmentName: null },
  ]);
  const screen = await renderWidget(<BirthdaysWidget />);

  await expect.element(screen.getByText("Nguyễn Văn An")).toBeVisible();
  await expect.element(screen.getByText("Phòng CNTT")).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Hôm nay" })).toBeVisible();
  await expect.element(screen.getByText("An Thị Phương")).toBeVisible();
  await expect.element(screen.getByText("25/12")).toBeVisible();
  expect(screen.container.querySelectorAll("li")).toHaveLength(2);
  await expect.element(screen.getByRole("heading", { name: "Sắp tới" })).toBeVisible();
});

test("the birthdays widget has no today's group when all of them are on days to come", async () => {
  serve("/occasions", [{ kind: "Birthday", date: "2099-12-25", userId: 2, fullName: "An Thị Phương", avatarUrl: null, departmentName: null }]);
  const screen = await renderWidget(<BirthdaysWidget />);

  await expect.element(screen.getByRole("heading", { name: "Sắp tới" })).toBeVisible();
  await expect.element(screen.getByText("Hôm nay")).not.toBeInTheDocument();
});

test("the birthdays widget says so when there are none", async () => {
  serve("/occasions", []);
  const screen = await renderWidget(<BirthdaysWidget />);
  await expect.element(screen.getByText("Không có sinh nhật nào trong 30 ngày tới")).toBeVisible();
});
