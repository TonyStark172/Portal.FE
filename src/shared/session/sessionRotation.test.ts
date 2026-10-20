import { expect, test } from "vitest";
import { makeStore } from "@/core/store";
import { signedIn } from "./sessionSlice";
import { applySessionRefresh, wasRotated } from "./sessionRotation";

test("an unchanged refresh token does not record a self-link", () => {
  const store = makeStore();
  const session = { accessToken: "same-token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" };
  store.dispatch(signedIn(session));
  const initial = store.getState().session;
  applySessionRefresh(store, initial, session);
  expect(store.getState().session).toBe(initial);
  expect(wasRotated(initial, initial)).toBe(false);
  store.dispatch(signedIn({ ...session, accessToken: "another-login" }));
  expect(wasRotated(initial, store.getState().session)).toBe(false);
});

test("a real rotation is recognized but a later login is not", () => {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "old", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  const initial = store.getState().session;
  applySessionRefresh(store, initial, { accessToken: "new", accessTokenExpiresAt: "2099-01-01T00:00:00Z" });
  expect(wasRotated(initial, store.getState().session)).toBe(true);
  store.dispatch(signedIn({ accessToken: "another-login", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  expect(wasRotated(initial, store.getState().session)).toBe(false);
});
