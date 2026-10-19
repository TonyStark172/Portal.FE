import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import {
  portalApi,
  type PaginatedListOfStaffEmployeeDto,
  type OrganizationDto,
  type StaffDashboardDto,
  type UserDto,
} from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { StaffDashboard } from "./StaffDashboard";

const dashboard: StaffDashboardDto = {
  from: "2026-10-01",
  to: "2026-10-31",
  gender: { male: 30, female: 20, unspecified: 0, total: 50 },
  staffChanges: { joined: 3, left: 1 },
  // 50 when the month began (52 less the 2 who joined in the first week), 52 at its end.
  trend: [
    { from: "2026-10-01", to: "2026-10-07", joined: 2, left: 0, headcount: 52 },
    { from: "2026-10-08", to: "2026-10-14", joined: 1, left: 1, headcount: 52 },
  ],
  departments: { items: [{ departmentId: 1, name: "Phòng CNTT", count: 50 }], withoutDepartment: 0 },
};

/** Three people, two of whom have not given their gender. */
const smallCompany: StaffDashboardDto = {
  ...dashboard,
  gender: { male: 1, female: 0, unspecified: 2, total: 3 },
};

const organization = { name: "Công ty ABC" } as OrganizationDto;

const employees: PaginatedListOfStaffEmployeeDto = {
  items: [],
  pageNumber: 1,
  totalPages: 0,
  totalCount: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

/** A store signed in as a user holding `permissions`; this month's figures are cached only when asked. */
async function signedInStore(permissions: string[], { cache = false, figures = dashboard } = {}) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(
    portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 1, fullName: "Nguyễn Văn An" } as UserDto,
      permissions,
    }),
  );
  if (cache) await store.dispatch(portalApi.util.upsertQueryData("getStaffDashboard", { period: "Month" }, figures));
  return store;
}

/** URLs requested from Portal.BE, each answered with sample figures. */
function watchRequests() {
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    return Response.json(url.includes("/employees") ? employees : url.includes("/Organization") ? organization : dashboard);
  });
  return () => fetches.mock.calls.map(([input]) => (input instanceof Request ? input.url : String(input)));
}

afterEach(async () => {
  vi.restoreAllMocks();
  await page.viewport(1000, 800);
});

describe("the staff dashboard", () => {
  /** Renders the dashboard with `figures` cached and waits for the key metrics. */
  async function renderKpis(figures: StaffDashboardDto = dashboard) {
    watchRequests();
    const store = await signedInStore([Permissions.Dashboard.Staff], { cache: true, figures });
    await render(
      <Provider store={store}>
        <StaffDashboard />
      </Provider>,
    );
    return vi.waitUntil(() => document.querySelector<HTMLElement>("[data-kpi-widget]"));
  }

  const slotText = (slot: string, part: "label" | "value" | "trend" | "note") =>
    document.querySelector(`[data-kpi='${slot}'] [data-slot='${part}']`)?.textContent;

  test("shows one key-metrics widget with the period and three labelled figures", async () => {
    const widget = await renderKpis();

    expect(widget.querySelector("h2")?.textContent).toBe("Chỉ số chính");
    expect(widget.querySelector("[data-widget-period]")?.textContent).toBe("Tháng này");
    expect(document.querySelectorAll("[data-kpi-widget]")).toHaveLength(1);
    expect([...widget.querySelectorAll("[data-kpi]")].map((slot) => slot.getAttribute("data-kpi"))).toEqual([
      "total",
      "gender",
      "changes",
    ]);
    expect(["total", "gender", "changes"].map((slot) => slotText(slot, "label"))).toEqual([
      "Tổng nhân sự",
      "Giới tính",
      "Biến động nhân sự",
    ]);
    expect(document.querySelector('button[aria-label="Làm mới số liệu"]')).toBeNull();
  });

  test("gives the headcount and how it moved since the period began", async () => {
    await renderKpis();

    expect(slotText("total", "value")).toBe("50");
    expect(slotText("total", "trend")).toBe("↑ +2 so với đầu kỳ"); // 3 joined, 1 left
  });

  test("splits the gender by share of the whole staff, not of those who gave their gender", async () => {
    await renderKpis(smallCompany);

    expect(slotText("gender", "value")).toBe("1 nam · 0 nữ");
    expect(slotText("gender", "trend")).toBe("Chưa cập nhật 2 · 67%");
    const bar = document.querySelector("[data-kpi='gender'] [role='img']")!;
    expect(bar.getAttribute("aria-label")).toBe("Nam 1 · 33%, Nữ 0 · 0%, Chưa cập nhật 2 · 67%");
  });

  test("sizes the gender bar's segments by those shares, and draws no ring or pie", async () => {
    await renderKpis(smallCompany);

    const bar = document.querySelector<HTMLElement>("[data-kpi='gender'] [role='img']")!;
    expect(document.querySelector("[data-kpi='gender'] svg")).toBeNull();
    const share = (key: string) =>
      (bar.querySelector<HTMLElement>(`[data-segment='${key}']`)?.getBoundingClientRect().width ?? 0) /
      bar.getBoundingClientRect().width;
    expect(share("male")).toBeCloseTo(1 / 3, 1);
    expect(share("female")).toBe(0); // nobody: no segment, and no gap
    expect(share("unspecified")).toBeCloseTo(2 / 3, 1);
  });

  test("sums up the staff changes of the period, with the turnover on the headcount at its start", async () => {
    // 52 at the end of the second week; 50 when the period began (after 3 joined and 1 left); 1 of the 50 left.
    await renderKpis();

    expect(slotText("changes", "value")).toBe("+2");
    expect(slotText("changes", "trend")).toBe("+3 vào làm · −1 nghỉ việc");
    expect(slotText("changes", "note")).toBe("Tỷ lệ nghỉ việc 2%");
  });

  test.each([
    ["is zero", 3],
    ["is unknown", null],
  ])("shows no turnover rate when the headcount at the start of the period %s", async (_case, headcount) => {
    await renderKpis({ ...dashboard, trend: [{ from: "2026-10-01", to: "2026-10-07", joined: 3, left: 0, headcount }] });

    expect(slotText("changes", "note")).toBe("Tỷ lệ nghỉ việc —");
  });

  test("draws a sparkline beside the headcount and the changes, but not the gender split", async () => {
    await page.viewport(1400, 900);
    await renderKpis();

    const sparkline = (slot: string) => document.querySelector<SVGElement>(`[data-kpi='${slot}'] [data-sparkline]`);
    await vi.waitFor(() => expect(sparkline("total")?.getBoundingClientRect().width).toBeGreaterThan(80));
    expect(sparkline("changes")?.getBoundingClientRect().width).toBeGreaterThan(80);
    expect(sparkline("total")?.getBoundingClientRect().height).toBe(56);
    expect(sparkline("gender")).toBeNull();
    // Up: the headcount rose, so the line is the success colour.
    expect(sparkline("total")?.querySelector("path:last-child")?.getAttribute("stroke")).toBe("var(--success)");
  });

  test("puts the three figures in one row on a desktop, parted by short thin lines", async () => {
    await page.viewport(1400, 900);
    await renderKpis();

    const slots = [...document.querySelectorAll<HTMLElement>("[data-kpi]")];
    const rects = slots.map((slot) => slot.getBoundingClientRect());
    expect(rects[0].top).toBe(rects[1].top);
    expect(rects[1].top).toBe(rects[2].top);
    expect(Math.abs(rects[0].width - rects[1].width)).toBeLessThanOrEqual(2);
    expect(Math.abs(rects[1].width - rects[2].width)).toBeLessThanOrEqual(2);
    const line = (slot: HTMLElement) => getComputedStyle(slot, "::before");
    expect(line(slots[0]).content).toBe("none");
    for (const slot of slots.slice(1)) {
      expect(line(slot).width).toBe("1px");
      // Shorter than the slot: it stops short of its top and bottom.
      expect(parseFloat(line(slot).height)).toBeLessThan(slot.getBoundingClientRect().height - 16);
    }
  });

  test("on a tablet, keeps the three figures side by side with their labels unbroken, without charts", async () => {
    // A tablet less the sidebar: the widget is about 650px wide.
    await page.viewport(680, 1000);
    await renderKpis();

    const group = document.querySelector<HTMLElement>("[data-kpi-group]")!;
    const slots = [...group.querySelectorAll<HTMLElement>("[data-kpi]")];
    expect(slots[0].getBoundingClientRect().top).toBe(slots[2].getBoundingClientRect().top);
    expect(group.scrollWidth).toBeLessThanOrEqual(group.clientWidth);
    expect(group.querySelector("[data-sparkline]")?.getBoundingClientRect().width).toBe(0);
    // The gender bar is no chart: it stays.
    expect(group.querySelector("[data-kpi='gender'] [role='img']")?.getBoundingClientRect().width).toBeGreaterThan(100);
    // The turnover leaves the label's line for one under the figures.
    const notes = [...group.querySelectorAll<HTMLElement>("[data-kpi='changes'] [data-slot='note']")];
    expect(notes.filter((note) => note.getBoundingClientRect().width > 0)).toHaveLength(1);
    expect(notes.find((note) => note.getBoundingClientRect().width > 0)!.getBoundingClientRect().top).toBeGreaterThan(
      group.querySelector("[data-kpi='changes'] [data-slot='trend']")!.getBoundingClientRect().top,
    );
    const lineHeight = (el: Element) => parseFloat(getComputedStyle(el).lineHeight);
    for (const label of group.querySelectorAll("[data-slot='label']")) {
      expect(label.getBoundingClientRect().height).toBeLessThanOrEqual(lineHeight(label) + 1);
    }
  });

  test("on a phone, stacks the figures one under another, each with its chart, and nothing scrolls sideways", async () => {
    await page.viewport(390, 844);
    await renderKpis();

    const group = document.querySelector<HTMLElement>("[data-kpi-group]")!;
    const slots = [...group.querySelectorAll<HTMLElement>("[data-kpi]")];
    const rects = slots.map((slot) => slot.getBoundingClientRect());
    expect(rects[1].top).toBeGreaterThanOrEqual(rects[0].bottom - 1);
    expect(rects[2].top).toBeGreaterThanOrEqual(rects[1].bottom - 1);
    for (const rect of rects) expect(Math.abs(rect.width - rects[0].width)).toBeLessThanOrEqual(1);
    // A line across the top of every slot but the first.
    expect(getComputedStyle(slots[1], "::before").height).toBe("1px");
    expect(group.querySelector("[data-kpi='total'] [data-sparkline]")?.getBoundingClientRect().width).toBeGreaterThan(80);
    // The turnover sits beside its label again.
    const note = [...group.querySelectorAll<HTMLElement>("[data-kpi='changes'] [data-slot='note']")].find(
      (element) => element.getBoundingClientRect().width > 0,
    )!;
    expect(Math.abs(note.getBoundingClientRect().bottom - group.querySelector("[data-kpi='changes'] [data-slot='label']")!.getBoundingClientRect().bottom)).toBeLessThan(4);
    expect(group.scrollWidth).toBeLessThanOrEqual(group.clientWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });

  test("is the analytics page only: no list of employees, and none asked for", async () => {
    const requests = watchRequests();
    const store = await signedInStore([Permissions.Dashboard.Staff], { cache: true });

    await render(
      <Provider store={store}>
        <StaffDashboard />
      </Provider>,
    );

    await vi.waitFor(() => expect(document.querySelector("[data-kpi='total']")).not.toBeNull());
    expect(document.querySelector("table, [role='grid']")).toBeNull();
    expect(document.body.textContent).not.toContain("Nhân sự đang làm việc");
    expect(requests().some((url) => url.includes("/employees"))).toBe(false);
  });

  test("asks for the chosen period", async () => {
    const requests = watchRequests();
    const store = await signedInStore([Permissions.Dashboard.Staff], { cache: true });
    await render(
      <Provider store={store}>
        <StaffDashboard />
      </Provider>,
    );

    const trigger = await vi.waitUntil(() => document.querySelector<HTMLElement>('[aria-label="Kỳ thống kê"] button, button[aria-label="Kỳ thống kê"]') ??
      [...document.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.includes("Tháng này")));
    await userEvent.click(trigger);
    const quarter = await vi.waitUntil(() =>
      [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((o) => o.textContent?.includes("Quý này")),
    );
    await userEvent.click(quarter);

    // The generated client names the parameter after the back end's ("Period"); ASP.NET ignores its case.
    await vi.waitFor(() => expect(requests().some((url) => /\/api\/Dashboard\/staff\?period=Quarter$/i.test(url))).toBe(true));
  });

  test("tells a user without Dashboard.Staff they may not see it, without asking for the statistics", async () => {
    const requests = watchRequests();
    const store = await signedInStore([Permissions.Posts.Create]);

    await render(
      <Provider store={store}>
        <StaffDashboard />
      </Provider>,
    );

    await vi.waitFor(() => expect(document.body.textContent).toContain("Bạn không có quyền xem mục này"));
    expect(document.querySelector("[data-kpi]")).toBeNull();
    expect(requests().some((url) => url.includes("/api/Dashboard"))).toBe(false);
  });

});

test.each([[390, 844], [1000, 800]])("at %ix%i the period's calendar icon sits on the line of its label", async (width, height) => {
  await page.viewport(width, height);
  watchRequests();
  const store = await signedInStore([Permissions.Dashboard.Staff], { cache: true });
  const screen = await render(
    <Provider store={store}>
      <StaffDashboard />
    </Provider>,
  );

  const trigger = screen.getByRole("button", { name: /Tháng này/ });
  await expect.element(trigger).toBeVisible();
  const icon = trigger.element().querySelector("svg")!.getBoundingClientRect();
  const label = trigger.element().querySelector(".select__value")!.getBoundingClientRect();
  expect(Math.abs(icon.top + icon.height / 2 - (label.top + label.height / 2))).toBeLessThanOrEqual(1);
});
