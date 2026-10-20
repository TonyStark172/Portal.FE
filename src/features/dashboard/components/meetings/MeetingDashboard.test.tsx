import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { portalApi, type MeetingDashboardDto, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { emptyMeetingDashboard, meetingDashboard } from "./fixtures";
import { MeetingDashboard } from "./MeetingDashboard";

/** A store signed in as a user holding `permissions`; this month's figures are cached only when given. */
async function signedInStore(permissions: string[], figures: MeetingDashboardDto | null) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(
    portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: 1, fullName: "An" } as UserDto, permissions }),
  );
  if (figures) await store.dispatch(portalApi.util.upsertQueryData("getMeetingDashboard", { period: "Month" }, figures));
  return store;
}

/** URLs requested from Portal.BE; `answer` replies to each (the sample figures by default). */
function watchRequests(answer: () => Promise<Response> = async () => Response.json(meetingDashboard)) {
  const fetches = vi.spyOn(window, "fetch").mockImplementation(answer);
  return () => fetches.mock.calls.map(([input]) => (input instanceof Request ? input.url : String(input)));
}

let stillness: HTMLStyleElement | undefined;
beforeAll(() => {
  stillness = document.createElement("style");
  stillness.textContent = ".kpi-rise, .kpi-wipe, .dashboard-reveal { animation: none !important; }";
  document.head.append(stillness);
});
afterAll(() => stillness?.remove());

afterEach(async () => {
  vi.restoreAllMocks();
  await page.viewport(1000, 800);
});

/** Renders the tab with `figures` cached for this month (`null`: nothing cached, so they are asked for). */
async function renderTab(figures: MeetingDashboardDto | null = meetingDashboard, permissions: string[] = [Permissions.Dashboard.Meetings]) {
  const store = await signedInStore(permissions, figures);
  return render(
    <Provider store={store}>
      <MeetingDashboard />
    </Provider>,
  );
}

const slotText = (slot: string, part: "label" | "value" | "trend" | "note") =>
  [...document.querySelectorAll(`[data-kpi='${slot}'] [data-slot='${part}']`)].map((el) => el.textContent)[0];

describe("the meetings analytics tab", () => {
  test("shows one key-metrics widget with the period and three labelled figures", async () => {
    watchRequests();
    await renderTab();

    const widget = await vi.waitUntil(() => document.querySelector<HTMLElement>("[data-kpi-widget]"));
    expect(widget.querySelector("h2")?.textContent).toBe("Chỉ số chính");
    expect(widget.querySelector("[data-widget-period]")?.textContent).toBe("Tháng này");
    expect([...widget.querySelectorAll("[data-kpi]")].map((slot) => slot.getAttribute("data-kpi"))).toEqual(["meetings", "hours", "participants"]);
    expect(["meetings", "hours", "participants"].map((slot) => slotText(slot, "label"))).toEqual([
      "Số cuộc họp",
      "Tổng giờ họp",
      "Người tham gia TB",
    ]);
  });

  test("gives the meetings, their hours and the people per meeting, each against the period before", async () => {
    watchRequests();
    await renderTab();

    await vi.waitFor(() => expect(slotText("meetings", "value")).toBe("12"));
    expect(slotText("meetings", "trend")).toBe("↑ +4 so với kỳ trước");
    expect(slotText("hours", "value")).toBe("18,5 giờ");
    expect(slotText("hours", "trend")).toBe("↓ −1,5 giờ so với kỳ trước");
    expect(slotText("participants", "value")).toBe("4,5");
    expect(slotText("participants", "note")).toBe("Đã huỷ 2");
  });

  test("says no change when the period matches the one before", async () => {
    watchRequests();
    await renderTab({ ...meetingDashboard, totals: { ...meetingDashboard.totals, previousMeetingCount: 12, previousTotalHours: 18.5 } });

    await vi.waitFor(() => expect(slotText("meetings", "trend")).toBe("→ 0 so với kỳ trước"));
    expect(slotText("hours", "trend")).toBe("→ 0 giờ so với kỳ trước");
  });

  test("draws the meetings and the hours step by step as sparklines, coloured by how they moved", async () => {
    await page.viewport(1400, 900);
    watchRequests();
    await renderTab();

    const sparkline = (slot: string) => document.querySelector<SVGElement>(`[data-kpi='${slot}'] [data-sparkline]`);
    await vi.waitFor(() => expect(sparkline("meetings")?.getBoundingClientRect().width).toBeGreaterThan(80));
    expect(sparkline("hours")?.getBoundingClientRect().width).toBeGreaterThan(80);
    expect(sparkline("participants")).toBeNull();
    expect(sparkline("meetings")?.querySelector("path:last-child")?.getAttribute("stroke")).toBe("var(--success)");
    expect(sparkline("hours")?.querySelector("path:last-child")?.getAttribute("stroke")).toBe("var(--danger)");
  });

  test("lays out the four cards in the grid, two by two on a desktop", async () => {
    await page.viewport(1400, 900);
    watchRequests();
    await renderTab();

    const titles = await vi.waitUntil(() => {
      const found = [...document.querySelectorAll("[data-span] .card__title, [data-span] h3")].map((el) => el.textContent);
      return found.length === 4 ? found : null;
    });
    expect(titles).toEqual(["Số cuộc họp theo thời gian", "Theo loại cuộc họp", "Phòng dùng nhiều nhất", "Thời điểm họp nhiều"]);
    const cells = [...document.querySelectorAll<HTMLElement>("[data-span]")].map((cell) => cell.getBoundingClientRect());
    expect(cells[0].top).toBe(cells[1].top);
    expect(cells[2].top).toBe(cells[3].top);
    expect(cells[2].top).toBeGreaterThan(cells[0].top);
  });

  test("shows zero figures and a friendly note in every card for a period without meetings", async () => {
    watchRequests(async () => Response.json(emptyMeetingDashboard));
    await renderTab(emptyMeetingDashboard);

    await vi.waitFor(() => expect(slotText("meetings", "value")).toBe("0"));
    expect(slotText("hours", "value")).toBe("0 giờ");
    expect(slotText("participants", "value")).toBe("0,0");
    expect(slotText("participants", "note")).toBe("Đã huỷ 0");
    const text = document.body.textContent ?? "";
    expect(text.match(/Chưa có cuộc họp nào trong kỳ này\./g)).toHaveLength(3);
    expect(text).toContain("Chưa có cuộc họp nào đặt phòng trong kỳ này.");
  });

  test("asks for the chosen period", async () => {
    const requests = watchRequests();
    await renderTab();

    const trigger = await vi.waitUntil(() =>
      [...document.querySelectorAll<HTMLElement>("button")].find((button) => button.textContent?.includes("Tháng này")),
    );
    await userEvent.click(trigger);
    const year = await vi.waitUntil(() =>
      [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((option) => option.textContent?.includes("Năm nay")),
    );
    await userEvent.click(year);

    await vi.waitFor(() => expect(requests().some((url) => /\/api\/Dashboard\/meetings\?period=Year$/i.test(url))).toBe(true));
    await vi.waitFor(() => expect(document.querySelector("[data-widget-period]")?.textContent).toBe("Năm nay"));
  });

  test("shows placeholders while the figures load", async () => {
    watchRequests(() => new Promise<Response>(() => {}));
    await renderTab(null);

    await vi.waitFor(() => expect(document.querySelectorAll("[role='status']").length).toBeGreaterThanOrEqual(5));
    expect(document.querySelector("[data-kpi]")).toBeNull();
  });

  test("offers a retry when the figures could not be loaded, and asks again", async () => {
    const requests = watchRequests(async () => new Response(null, { status: 500 }));
    const screen = await renderTab(null);

    const retry = screen.getByRole("button", { name: "Thử lại" });
    await expect.element(retry).toBeVisible();
    const asked = requests().length;
    await retry.click();
    await vi.waitFor(() => expect(requests().length).toBeGreaterThan(asked));
  });

  test("tells a user without Dashboard.Meetings they may not see it, without asking for the figures", async () => {
    const requests = watchRequests();
    await renderTab(null, [Permissions.Dashboard.Staff]);

    await vi.waitFor(() => expect(document.body.textContent).toContain("Bạn không có quyền xem mục này"));
    expect(document.querySelector("[data-kpi]")).toBeNull();
    expect(requests().some((url) => url.includes("/api/Dashboard"))).toBe(false);
  });

  test("on a phone, leads with the meetings as a wide tile over two, and never scrolls sideways", async () => {
    await page.viewport(390, 844);
    watchRequests();
    await renderTab();

    const group = await vi.waitUntil(() => document.querySelector<HTMLElement>("[data-kpi-group]"));
    const [meetings, hours, participants] = ["meetings", "hours", "participants"].map(
      (id) => group.querySelector<HTMLElement>(`[data-kpi='${id}']`)!.getBoundingClientRect(),
    );
    expect(meetings.width).toBeGreaterThan(hours.width * 1.8);
    expect(hours.top).toBeGreaterThanOrEqual(meetings.bottom - 1);
    expect(hours.top).toBe(participants.top);
    const chart = group.querySelector("[data-kpi='meetings'] [data-sparkline]")!.getBoundingClientRect();
    expect(Math.abs(chart.bottom - meetings.bottom)).toBeLessThan(2);
    await vi.waitFor(() => expect(document.querySelectorAll("[data-span]")).toHaveLength(4));
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
    for (const card of document.querySelectorAll<HTMLElement>("[data-span]")) {
      expect(card.getBoundingClientRect().right).toBeLessThanOrEqual(390);
    }
  });
});
