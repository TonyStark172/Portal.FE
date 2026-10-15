import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { portalApi, type UserDto } from "@/shared/api/generated/portalApi";
import { signedIn } from "@/shared/session/sessionSlice";
import { AdminLayout } from "./AdminLayout";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/admin/users" }));
afterEach(() => vi.restoreAllMocks());

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
