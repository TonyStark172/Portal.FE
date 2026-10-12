import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import {
  portalApi,
  type PaginatedListOfStaffEmployeeDto,
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
  trend: [{ from: "2026-10-01", to: "2026-10-07", joined: 3, left: 1, headcount: 50 }],
  departments: { items: [{ departmentId: 1, name: "Phòng CNTT", count: 50 }], withoutDepartment: 0 },
};

const employees: PaginatedListOfStaffEmployeeDto = {
  items: [],
  pageNumber: 1,
  totalPages: 0,
  totalCount: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

/** A store signed in as a user holding `permissions`; this month's figures are cached only when asked. */
async function signedInStore(permissions: string[], { cache = false } = {}) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(
    portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 1, fullName: "Nguyễn Văn An" } as UserDto,
      permissions,
    }),
  );
  if (cache) await store.dispatch(portalApi.util.upsertQueryData("getStaffDashboard", { period: "Month" }, dashboard));
  return store;
}

/** URLs requested from Portal.BE, each answered with sample figures. */
function watchRequests() {
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    return Response.json(url.includes("/employees") ? employees : dashboard);
  });
  return () => fetches.mock.calls.map(([input]) => (input instanceof Request ? input.url : String(input)));
}

afterEach(async () => {
  vi.restoreAllMocks();
  await page.viewport(1000, 800);
});

describe("the staff dashboard", () => {
  test("shows the headcount and the changes of the month", async () => {
    watchRequests();
    const store = await signedInStore([Permissions.Dashboard.Staff], { cache: true });

    await render(
      <Provider store={store}>
        <StaffDashboard />
      </Provider>,
    );

    await vi.waitFor(() => expect(document.querySelector("[data-kpi='total']")?.textContent).toContain("50"));
    expect(document.querySelector("[data-kpi='total']")?.textContent).toContain("+2"); // 3 joined, 1 left
    expect(document.querySelector("[data-kpi='male']")?.textContent).toContain("60%");
    expect(document.querySelector("[data-kpi='female']")?.textContent).toContain("20");
    expect(document.querySelector("[data-kpi='joined']")?.textContent).toContain("3");
    expect(document.querySelector("[data-kpi='left']")?.textContent).toContain("1");
    expect(document.querySelector('button[aria-label="Làm mới số liệu"]')).toBeNull();
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

  test("on a phone, leaves no hole beside the last of the five headline cards", async () => {
    await page.viewport(390, 844);
    watchRequests();
    const store = await signedInStore([Permissions.Dashboard.Staff], { cache: true });
    await render(
      <Provider store={store}>
        <StaffDashboard />
      </Provider>,
    );

    const last = await vi.waitUntil(() => document.querySelector<HTMLElement>("[data-kpi='left']"));
    const grid = last.parentElement!;
    expect(grid.querySelectorAll("[data-kpi]")).toHaveLength(5);
    expect(Math.abs(last.getBoundingClientRect().width - grid.getBoundingClientRect().width)).toBeLessThanOrEqual(2);
    const first = grid.querySelector<HTMLElement>("[data-kpi='total']")!;
    expect(first.getBoundingClientRect().width).toBeLessThan(grid.getBoundingClientRect().width / 2 + 2);
  });

  test("on a phone, sorts the people by the column header tapped with a single request", async () => {
    await page.viewport(390, 844);
    const requests = watchRequests();
    const store = await signedInStore([Permissions.Dashboard.Staff], { cache: true });
    const screen = await render(
      <Provider store={store}>
        <StaffDashboard />
      </Provider>,
    );

    await userEvent.click(screen.getByRole("columnheader", { name: "Thâm niên" }));

    await vi.waitFor(() => expect(requests().some((url) => /\/employees\?.*sortBy=Seniority/i.test(url))).toBe(true));
    expect(requests().filter((url) => /\/employees\?.*sortBy=Seniority/i.test(url))).toHaveLength(1);
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
