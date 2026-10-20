import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { portalApi, type StaffDashboardDto, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { AnalyticsLayout } from "./AnalyticsLayout";
import { MeetingDashboard } from "./meetings/MeetingDashboard";
import { meetingDashboard } from "./meetings/fixtures";
import { StaffDashboard } from "./staff/StaffDashboard";

const route = vi.hoisted(() => ({ pathname: "/dashboard", replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: route.replace }), usePathname: () => route.pathname }));

const staff: StaffDashboardDto = {
  from: "2026-10-01",
  to: "2026-10-31",
  gender: { male: 1, female: 1, unspecified: 0, total: 2 },
  staffChanges: { joined: 0, left: 0 },
  trend: [{ from: "2026-10-01", to: "2026-10-07", joined: 0, left: 0, headcount: 2 }],
  departments: { items: [], withoutDepartment: 2 },
};

afterEach(async () => {
  vi.restoreAllMocks();
  route.pathname = "/dashboard";
  route.replace.mockReset();
  await page.viewport(1000, 800);
});

/** URLs requested from Portal.BE, each answered with sample figures. */
function watchRequests() {
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    return Response.json(url.includes("/Dashboard/meetings") ? meetingDashboard : staff);
  });
  return () => fetches.mock.calls.map(([input]) => (input instanceof Request ? input.url : String(input)));
}

async function signedInStore(permissions: string[]) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(
    portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: 1, fullName: "An" } as UserDto, permissions }),
  );
  return store;
}

const both = [Permissions.Dashboard.Staff, Permissions.Dashboard.Meetings];

/** The page for `pathname`: the layout around the tab that route renders. */
const tabFor = (pathname: string) => (pathname === "/dashboard/meetings" ? <MeetingDashboard /> : <StaffDashboard />);

async function renderAnalytics(permissions: string[], pathname = "/dashboard") {
  route.pathname = pathname;
  const store = await signedInStore(permissions);
  const screen = await render(
    <Provider store={store}>
      <AnalyticsLayout>{tabFor(pathname)}</AnalyticsLayout>
    </Provider>,
  );
  return { store, screen };
}

describe("the analytics page", () => {
  test("offers the HR and Meetings tabs, each a link of its own, to whoever may see both", async () => {
    watchRequests();
    const { screen } = await renderAnalytics(both);

    const tabs = screen.getByRole("tablist", { name: "Phân tích" });
    await expect.element(tabs).toBeVisible();
    const links = [...tabs.element().querySelectorAll("a")];
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Nhân sự", "/dashboard"],
      ["Cuộc họp", "/dashboard/meetings"],
    ]);
    await expect.element(screen.getByRole("tab", { name: "Nhân sự" })).toHaveAttribute("aria-selected", "true");
  });

  test("selects the Meetings tab on /dashboard/meetings", async () => {
    watchRequests();
    const { screen } = await renderAnalytics(both, "/dashboard/meetings");

    await expect.element(screen.getByRole("tab", { name: "Cuộc họp" })).toHaveAttribute("aria-selected", "true");
    await expect.element(screen.getByRole("tab", { name: "Nhân sự" })).toHaveAttribute("aria-selected", "false");
  });

  test.each([
    ["Dashboard.Staff", Permissions.Dashboard.Staff, "/dashboard"],
    ["Dashboard.Meetings", Permissions.Dashboard.Meetings, "/dashboard/meetings"],
  ])("shows no tab bar to whoever holds %s alone", async (_name, permission, pathname) => {
    watchRequests();
    await renderAnalytics([permission], pathname);

    await vi.waitFor(() => expect(document.querySelector("[data-kpi-widget]")).not.toBeNull());
    expect(document.querySelector("[role='tablist']")).toBeNull();
    expect(route.replace).not.toHaveBeenCalled();
  });

  test("opens the Meetings tab at /dashboard for whoever may see only the meetings", async () => {
    const requests = watchRequests();
    await renderAnalytics([Permissions.Dashboard.Meetings]);

    await vi.waitFor(() => expect(route.replace).toHaveBeenCalledWith("/dashboard/meetings"));
    expect(requests().some((url) => url.includes("/Dashboard/staff"))).toBe(false);
  });

  test("tells whoever may see neither tab that they may not, without tabs or a redirect", async () => {
    const requests = watchRequests();
    await renderAnalytics([Permissions.Posts.Create]);

    await vi.waitFor(() => expect(document.body.textContent).toContain("Bạn không có quyền xem mục này"));
    expect(document.querySelector("[role='tablist']")).toBeNull();
    expect(route.replace).not.toHaveBeenCalled();
    expect(requests().some((url) => url.includes("/api/Dashboard"))).toBe(false);
  });

  test("tells whoever lacks Dashboard.Meetings, on its link, that they may not see it", async () => {
    const requests = watchRequests();
    await renderAnalytics([Permissions.Dashboard.Staff], "/dashboard/meetings");

    await vi.waitFor(() => expect(document.body.textContent).toContain("Bạn không có quyền xem mục này"));
    expect(requests().some((url) => url.includes("/Dashboard/meetings"))).toBe(false);
  });

  test("puts the period on the tabs' row, and keeps the one chosen when switching tabs", async () => {
    const requests = watchRequests();
    const { store, screen } = await renderAnalytics(both, "/dashboard/meetings");

    const toolbar = await vi.waitUntil(() => document.querySelector<HTMLElement>("[data-analytics-toolbar]"));
    const trigger = await vi.waitUntil(() =>
      [...toolbar.querySelectorAll<HTMLElement>("button")].find((button) => button.textContent?.includes("Tháng này")),
    );
    const tablist = toolbar.querySelector("[role='tablist']")!.getBoundingClientRect();
    const picker = trigger.getBoundingClientRect();
    expect(picker.top).toBeLessThan(tablist.bottom);
    expect(picker.bottom).toBeGreaterThan(tablist.top);

    await userEvent.click(trigger);
    const quarter = await vi.waitUntil(() =>
      [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((option) => option.textContent?.includes("Quý này")),
    );
    await userEvent.click(quarter);
    await vi.waitFor(() => expect(requests().some((url) => /\/api\/Dashboard\/meetings\?period=Quarter$/i.test(url))).toBe(true));

    // Following the HR tab's link: the same layout, another page.
    route.pathname = "/dashboard";
    await screen.rerender(
      <Provider store={store}>
        <AnalyticsLayout>
          <StaffDashboard />
        </AnalyticsLayout>
      </Provider>,
    );
    await vi.waitFor(() => expect(requests().some((url) => /\/api\/Dashboard\/staff\?period=Quarter$/i.test(url))).toBe(true));
    expect(requests().some((url) => /\/api\/Dashboard\/staff\?period=Month$/i.test(url))).toBe(false);
    expect(document.querySelector("[data-analytics-toolbar]")?.textContent).toContain("Quý này");
  });

  test("on a phone, fits the tabs and the period on the screen, without scrolling sideways", async () => {
    await page.viewport(390, 844);
    watchRequests();
    await renderAnalytics(both, "/dashboard/meetings");

    await vi.waitFor(() => expect(document.querySelector("[data-kpi-widget]")).not.toBeNull());
    await vi.waitFor(() => expect(document.querySelector("[data-analytics-toolbar] button[aria-haspopup]")).not.toBeNull());
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });
});
