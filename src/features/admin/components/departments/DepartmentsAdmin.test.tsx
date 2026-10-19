import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { portalApi, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { DepartmentsAdmin } from "./DepartmentsAdmin";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/admin/departments" }));
afterEach(() => vi.restoreAllMocks());

function Harness({ permissions }: { permissions: string[] }) {
  // One store per test: RTK Query keeps what it read, which must not leak from one test into the next.
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 9, fullName: "Quản lý", isAdministrator: false } as UserDto,
      permissions,
    }));
    return own;
  });
  return <Provider store={store}><DepartmentsAdmin /></Provider>;
}

test("without Departments.View, the no-access alert", async () => {
  const screen = await render(<Harness permissions={[Permissions.Users.View]} />);
  await expect.element(screen.getByText("Bạn không có quyền xem mục quản trị.")).toBeVisible();
});

test("with Departments.View, the page region and no alert", async () => {
  const screen = await render(<Harness permissions={[Permissions.Departments.View]} />);
  await expect.element(screen.getByRole("region", { name: "Phòng ban" })).toBeInTheDocument();
  await expect.element(screen.getByText("Bạn không có quyền xem mục quản trị.")).not.toBeInTheDocument();
});
