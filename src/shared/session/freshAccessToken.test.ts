import { afterEach, expect, test, vi } from "vitest";
import { makeStore } from "@/core/store";
import { freshAccessToken } from "./freshAccessToken";
import { signedIn } from "./sessionSlice";
import { tokenExpiringIn } from "./token.testing";

const session = (accessToken: string) => ({ accessToken, accessTokenExpiresAt: "2099-01-01T00:00:00Z" });
const signedInStore = (accessToken: string) => {
  const store = makeStore();
  store.dispatch(signedIn(session(accessToken)));
  return store;
};

afterEach(() => vi.restoreAllMocks());

test("a token that has time left is returned as it is", async () => {
  const token = tokenExpiringIn(600);
  const fetches = vi.spyOn(window, "fetch");

  await expect(freshAccessToken(signedInStore(token))).resolves.toBe(token);

  expect(fetches).not.toHaveBeenCalled();
});

test("a token the browser cannot read the expiry of is returned as it is", async () => {
  const fetches = vi.spyOn(window, "fetch");

  await expect(freshAccessToken(signedInStore("opaque"))).resolves.toBe("opaque");

  expect(fetches).not.toHaveBeenCalled();
});

test("an expired token is refreshed once for everyone who asks, and the session keeps the new one", async () => {
  const store = signedInStore(tokenExpiringIn(-60));
  const renewed = tokenExpiringIn(1800);
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async () => Response.json(session(renewed)));

  await expect(Promise.all([freshAccessToken(store), freshAccessToken(store)])).resolves.toEqual([renewed, renewed]);

  expect(fetches).toHaveBeenCalledTimes(1);
  expect(store.getState().session.accessToken).toBe(renewed);
});

test("a token that runs out within the half minute is refreshed too", async () => {
  const renewed = tokenExpiringIn(1800);
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json(session(renewed)));

  await expect(freshAccessToken(signedInStore(tokenExpiringIn(10)))).resolves.toBe(renewed);
});

test("a refresh the server refuses signs out", async () => {
  const store = signedInStore(tokenExpiringIn(-60));
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ status: 401, code: "session_expired" }, { status: 401 }));

  await expect(freshAccessToken(store)).rejects.toThrow();

  expect(store.getState().session.status).toBe("anonymous");
});

test("a refresh that never reached the server leaves the session as it is, to be tried again", async () => {
  const token = tokenExpiringIn(-60);
  const store = signedInStore(token);
  vi.spyOn(window, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

  await expect(freshAccessToken(store)).rejects.toThrow();

  expect(store.getState().session).toMatchObject({ status: "authenticated", accessToken: token });
});

test("without a session there is no token", async () => {
  await expect(freshAccessToken(makeStore())).resolves.toBe("");
});
