import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { PeoplePicker } from "./PeoplePicker";

afterEach(() => vi.restoreAllMocks());

/** Hands a mocked fetch what RTK Query sent (it passes a Request). */
const withRequest = (handler: (url: string) => Promise<Response> | Response) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
    return handler(request.url);
  };

const user = (id: number, fullName: string, userName: string) =>
  ({ id, fullName, userName, emailConfirmed: true, isAdministrator: false, isActive: true, mustChangePassword: false, needsOnboarding: false, assignments: [], roles: [] }) as UserDto;
const everyone = [user(9, "Võ Thị Hoa", "hoa.vt"), user(10, "Đặng Quốc", "quoc.d")];

/** Answers the users list (filtered by `search` the way the server would); returns the queries it received. */
function mockUsers() {
  const queries: URLSearchParams[] = [];
  vi.spyOn(window, "fetch").mockImplementation(withRequest((url) => {
    const { pathname, searchParams } = new URL(url);
    if (!pathname.endsWith("/api/Users")) return Response.json({});
    queries.push(searchParams);
    const search = (searchParams.get("Search") ?? "").toLowerCase();
    const items = everyone.filter((candidate) => candidate.fullName.toLowerCase().includes(search));
    return Response.json({ items, pageNumber: 1, totalPages: 1, totalCount: items.length, hasPreviousPage: false, hasNextPage: false });
  }));
  return queries;
}

function Harness({ disabledIds, onChange }: { disabledIds?: number[]; onChange?: (ids: number[]) => void }) {
  const [store] = useState(() => {
    const own = makeStore();
    own.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    void own.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 1, fullName: "Quản lý", isAdministrator: false } as UserDto,
      permissions: [Permissions.Users.View],
    }));
    return own;
  });
  const [ids, setIds] = useState<number[]>([]);
  return (
    <Provider store={store}>
      <PeoplePicker
        label="Nhân viên"
        hint="Chọn một hay nhiều người."
        value={ids}
        disabledIds={disabledIds}
        onChange={(next) => {
          setIds(next);
          onChange?.(next);
        }}
      />
    </Provider>
  );
}

test("asks only for active people, and for matches once typing pauses", async () => {
  const queries = mockUsers();
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("button", { name: /Võ Thị Hoa/ })).toBeVisible();
  expect(queries[0].get("IsActive")).toBe("true");
  expect(queries[0].get("PageSize")).toBe("20");
  expect(queries[0].get("Search")).toBeNull();

  await userEvent.fill(screen.getByRole("searchbox", { name: "Tìm nhân viên" }), "Đặng");
  await vi.waitFor(() => expect(queries.at(-1)?.get("Search")).toBe("Đặng"));
  await expect.element(screen.getByRole("button", { name: /Đặng Quốc/ })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /Võ Thị Hoa/ })).not.toBeInTheDocument();
});

test("a chosen person stays as a chip when a later search no longer lists them, and the chip removes them", async () => {
  mockUsers();
  const changes: number[][] = [];
  const screen = await render(<Harness onChange={(ids) => changes.push(ids)} />);
  await userEvent.click(screen.getByRole("button", { name: /Võ Thị Hoa/ }));
  expect(changes.at(-1)).toEqual([9]);
  await expect.element(screen.getByRole("button", { name: "Bỏ chọn Võ Thị Hoa" })).toBeVisible();

  await userEvent.fill(screen.getByRole("searchbox", { name: "Tìm nhân viên" }), "Đặng");
  await expect.element(screen.getByRole("button", { name: /Võ Thị Hoa/, exact: false }).first()).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: /Đặng Quốc/ }));
  expect(changes.at(-1)).toEqual([9, 10]);

  await userEvent.click(screen.getByRole("button", { name: "Bỏ chọn Võ Thị Hoa" }));
  expect(changes.at(-1)).toEqual([10]);
  await expect.element(screen.getByRole("button", { name: "Bỏ chọn Võ Thị Hoa" })).not.toBeInTheDocument();
});

test("people who cannot be chosen are listed but disabled", async () => {
  mockUsers();
  const screen = await render(<Harness disabledIds={[10]} />);
  await expect.element(screen.getByRole("button", { name: /Đặng Quốc/ })).toBeDisabled();
  await expect.element(screen.getByRole("button", { name: /Võ Thị Hoa/ })).toBeEnabled();
  await expect.element(screen.getByText("Chọn một hay nhiều người.")).toBeVisible();
});
