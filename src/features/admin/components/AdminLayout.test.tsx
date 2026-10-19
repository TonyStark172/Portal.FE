import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { portalApi, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { AdminLayout } from "./AdminLayout";

const route = vi.hoisted(() => ({ pathname: "/admin/users" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => route.pathname }));
afterEach(() => {
  vi.restoreAllMocks();
  route.pathname = "/admin/users";
});

async function renderLayout() {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
    user: { id: 1, fullName: "An", isAdministrator: true } as UserDto,
    permissions: [Permissions.Users.View, Permissions.Departments.View, Permissions.Positions.View],
  }));
  return render(<Provider store={store}><AdminLayout><p>Nội dung</p></AdminLayout></Provider>);
}

test("a tab label stays on one line, however long it is", async () => {
  const screen = await renderLayout();

  const tab = screen.getByRole("tab", { name: "Chức vụ" });
  await expect.element(tab).toBeVisible();
  expect(getComputedStyle(tab.element()).whiteSpace).toBe("nowrap");
});

test("every tab uses the whole width, so the tab bar stays put when switching tabs", async () => {
  const tabBarLeft: number[] = [];
  for (const pathname of ["/admin/users", "/admin/departments", "/admin/positions"]) {
    route.pathname = pathname;
    const screen = await renderLayout();
    const section = screen.getByRole("region", { name: "Quản trị" }).element();
    expect(getComputedStyle(section).maxWidth).toBe("none");
    tabBarLeft.push(screen.getByRole("tablist", { name: "Quản trị" }).element().getBoundingClientRect().left);
    screen.unmount();
  }
  expect(new Set(tabBarLeft).size).toBe(1);
});

test("the departments tab uses the whole width, and the height of the screen below the app header", async () => {
  route.pathname = "/admin/departments";
  const screen = await renderLayout();
  const section = screen.getByRole("region", { name: "Quản trị" }).element();
  expect(getComputedStyle(section).maxWidth).toBe("none");
  expect(section.className).toContain("admin-fill");
  expect(section.getBoundingClientRect().height).toBeGreaterThanOrEqual(512);
});
