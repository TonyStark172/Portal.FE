import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { portalApi, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { AdminLayout } from "./AdminLayout";

const navigation = vi.hoisted(() => ({ pathname: "/admin/users" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => navigation.pathname }));
afterEach(async () => { vi.restoreAllMocks(); navigation.pathname = "/admin/users"; await page.viewport(1000, 800); });

test("a tab label stays on one line, however long it is", async () => {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
    user: { id: 1, fullName: "An", isAdministrator: true } as UserDto,
    permissions: [],
  }));
  const screen = await render(<Provider store={store}><AdminLayout><p>Nội dung</p></AdminLayout></Provider>);

  const tab = screen.getByRole("tab", { name: "Vai trò & quyền" });
  await expect.element(tab).toBeVisible();
  expect(getComputedStyle(tab.element()).whiteSpace).toBe("nowrap");
});

/** Signs in someone holding `permissions`, then shows the layout around a page. */
async function renderLayout(permissions: string[]) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
    user: { id: 1, fullName: "An", isAdministrator: false } as UserDto,
    permissions,
  }));
  return render(<Provider store={store}><AdminLayout><p>Nội dung</p></AdminLayout></Provider>);
}

for (const [screenName, width] of [["a wide", 1280], ["a phone's", 375]] as const) {
  test(`on ${screenName} screen the sections are tabs across the top, the current one underlined`, async () => {
    await page.viewport(width, 800);
    const screen = await renderLayout([Permissions.Users.View, Permissions.Departments.View]);

    const tabs = screen.getByRole("tablist", { name: "Quản trị" });
    await expect.element(tabs).toBeVisible();
    expect(screen.getByRole("tab").elements().map((tab) => tab.textContent)).toEqual(["Phòng ban", "Người dùng"]);
    await expect.element(screen.getByRole("tab", { name: "Người dùng" })).toHaveAttribute("aria-selected", "true");
    await expect.element(screen.getByRole("navigation", { name: "Quản trị" })).not.toBeInTheDocument();
    await expect.element(screen.getByText("Nội dung")).toBeVisible();

    // One thin line under the whole row, as wide as the page; the current tab underlined on it, the others not.
    const row = tabs.element().closest(".tabs__list-container") as HTMLElement;
    const section = screen.getByRole("region", { name: "Quản trị" }).element();
    expect(getComputedStyle(row).borderBottomWidth).toBe("1px");
    expect(row.getBoundingClientRect().width).toBe(section.getBoundingClientRect().width);
    const underline = screen.getByRole("tab", { name: "Người dùng" }).element().querySelector(".tabs__indicator") as HTMLElement;
    expect(underline.getBoundingClientRect().height).toBe(2);
    // It rests on the line (just above it: the row's scrolling clips anything drawn over its border).
    expect(row.getBoundingClientRect().bottom - underline.getBoundingClientRect().bottom).toBeCloseTo(1, 0);
    for (const other of screen.getByRole("tab", { name: "Phòng ban" }).element().querySelectorAll(".tabs__indicator"))
      expect(getComputedStyle(other).opacity === "0" || other.getBoundingClientRect().height === 0).toBe(true);
  });
}

test("on a phone the row scrolls to the current tab, so it is never hidden past the edge", async () => {
  await page.viewport(375, 800);
  // The administrator sees all five; the last (the current one) does not fit without scrolling.
  navigation.pathname = "/admin/roles";
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
    user: { id: 1, fullName: "An", isAdministrator: true } as UserDto,
    permissions: Object.values(Permissions).flatMap((group) => Object.values(group)),
  }));
  const screen = await render(<Provider store={store}><AdminLayout><p>Nội dung</p></AdminLayout></Provider>);

  const current = screen.getByRole("tab", { name: "Vai trò & quyền" });
  await expect.element(current).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => {
    // The part of the row on screen: the row itself, within the window.
    const row = (screen.getByRole("tablist").element().closest(".tabs__list-container") as HTMLElement).getBoundingClientRect();
    const tab = current.element().getBoundingClientRect();
    return tab.left >= Math.max(row.left, 0) - 1 && tab.right <= Math.min(row.right, window.innerWidth) + 1;
  }).toBe(true);
});

test("on a very wide screen administration takes the whole width, not a centred column", async () => {
  await page.viewport(1800, 800);
  const screen = await renderLayout([Permissions.Users.View]);

  const section = screen.getByRole("region", { name: "Quản trị" }).element();
  await expect.element(screen.getByText("Nội dung")).toBeVisible();
  expect(section.getBoundingClientRect().width).toBe((section.parentElement as HTMLElement).getBoundingClientRect().width);
});
