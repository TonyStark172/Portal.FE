import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { signedIn } from "@/shared/session/sessionSlice";
import type { WorkDay } from "@/features/meetings/workWeek";
import { WorkWeekEditor } from "./WorkWeekEditor";
afterEach(() => vi.restoreAllMocks());

/** Hands a mocked fetch what RTK Query sent (it passes a Request). */
const withRequest = (handler: (url: string, init: { method: string; body: string | null }) => Promise<Response> | Response) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    return handler(request.url, { method: request.method, body: ["GET", "HEAD"].includes(request.method) ? null : await request.clone().text() });
  };

const office = (day: WorkDay["day"]): WorkDay => ({ day, start: "08:00", end: "17:00" });
const off = (day: WorkDay["day"]): WorkDay => ({ day, start: null, end: null });
const defaultWeek: WorkDay[] = [off("Sunday"), office("Monday"), office("Tuesday"), office("Wednesday"), office("Thursday"), office("Friday"), off("Saturday")];

function Harness() {
  // One store per test: RTK Query keeps what it read, which must not leak from one test into the next.
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    return own;
  });
  return <Provider store={store}><WorkWeekEditor /></Provider>;
}

function mockWorkWeek(put: (body: unknown) => Response) {
  const puts: unknown[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withRequest((url, init) => {
    if (!url.includes("/api/Organization/work-week")) return Response.json({});
    if (init.method === "PUT") { const body = JSON.parse(init.body!); puts.push(body); return put(body); }
    return Response.json({ days: defaultWeek });
  }));
  return puts;
}

test("Saturday mornings: pick the day, give it its own hours, and save them", async () => {
  const puts = mockWorkWeek(() => new Response(null, { status: 204 }));
  const screen = await render(<Harness />);
  await expect.element(screen.getByText("T2–T6 08:00–17:00 · Nghỉ T7, CN", { exact: true })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "T7", exact: true }));
  await expect.element(screen.getByText("T2–T7 08:00–17:00 · Nghỉ CN", { exact: true })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Giờ riêng cho từng ngày" }));
  await userEvent.click(screen.getByRole("button", { name: /Thêm giờ riêng cho ngày/ }));
  await userEvent.click(screen.getByRole("option", { name: "T7", exact: true }));
  await userEvent.click(screen.getByRole("button", { name: /Giờ kết thúc T7/ }));
  await userEvent.click(screen.getByRole("option", { name: "12:00", exact: true }));
  await expect.element(screen.getByText("T2–T6 08:00–17:00 · T7 08:00–12:00 · Nghỉ CN", { exact: true })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Lưu", exact: true }));
  await expect.element(screen.getByRole("status")).toHaveTextContent("Đã lưu.");
  expect(puts).toEqual([{ days: defaultWeek.map(d => d.day === "Saturday" ? { day: "Saturday", start: "08:00", end: "12:00" } : d) }]);
});

test("the server's objection to the week shows next to it", async () => {
  mockWorkWeek(() => Response.json({
    status: 400, code: "validation_failed", detail: "Vui lòng kiểm tra lại các trường được báo lỗi.",
    errors: { Days: ["Tuần làm việc phải có đủ bảy ngày, mỗi ngày một lần."] },
  }, { status: 400 }));
  const screen = await render(<Harness />);
  await expect.element(screen.getByText("T2–T6 08:00–17:00 · Nghỉ T7, CN", { exact: true })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Lưu", exact: true }));
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Tuần làm việc phải có đủ bảy ngày, mỗi ngày một lần.");
});

test("a range that ends before it starts is not sent", async () => {
  const puts = mockWorkWeek(() => new Response(null, { status: 204 }));
  const screen = await render(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: /^\S+ Giờ kết thúc$/ }));
  await userEvent.click(screen.getByRole("option", { name: "07:00", exact: true }));
  await userEvent.click(screen.getByRole("button", { name: "Lưu", exact: true }));
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Giờ kết thúc phải sau giờ bắt đầu.");
  expect(puts).toEqual([]);
});
