import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { expect, test } from "vitest";
import { renderHook } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { portalApi, type UserDto } from "@/shared/api/generated/portalApi";
import { signedIn } from "@/shared/session/sessionSlice";
import { useCurrentUser } from "./useCurrentUser";

async function storeWith(user: Partial<UserDto>) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: 1, fullName: "An", ...user } as UserDto, permissions: [] }));
  return store;
}

function wrapperFor(store: Awaited<ReturnType<typeof storeWith>>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

test("tells the administrator and a temporary password apart", async () => {
  const store = await storeWith({ isAdministrator: true, mustChangePassword: true });
  const { result } = await renderHook(() => useCurrentUser(), { wrapper: wrapperFor(store) });
  expect(result.current.isAdministrator).toBe(true);
  expect(result.current.mustChangePassword).toBe(true);
});

test("by default neither", async () => {
  const store = await storeWith({});
  const { result } = await renderHook(() => useCurrentUser(), { wrapper: wrapperFor(store) });
  expect(result.current.isAdministrator).toBe(false);
  expect(result.current.mustChangePassword).toBe(false);
});
