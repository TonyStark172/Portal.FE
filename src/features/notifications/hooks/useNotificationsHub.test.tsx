import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { renderHook } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { applySessionRefresh } from "@/shared/session/sessionRotation";
import { signedIn, signedOut } from "@/shared/session/sessionSlice";
import { tokenExpiringIn } from "@/shared/session/token.testing";
import { fakeHub } from "./fakeHub.testing";
import { useNotificationsHub } from "./useNotificationsHub";

vi.mock("@microsoft/signalr", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@microsoft/signalr")>()),
  HubConnectionBuilder: (await import("./fakeHub.testing")).FakeHubConnectionBuilder,
}));

const session = (accessToken: string) => ({ accessToken, accessTokenExpiresAt: "2099-01-01T00:00:00Z" });

async function setup(onSignal: Parameters<typeof useNotificationsHub>[0] = () => {}) {
  const store = makeStore();
  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
  const rendered = await renderHook(() => useNotificationsHub(onSignal), { wrapper });
  const signIn = (token = tokenExpiringIn(1800)) => rendered.act(() => void store.dispatch(signedIn(session(token))));
  return { ...rendered, store, signIn };
}

beforeEach(() => fakeHub.reset());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("connects to the hub through the proxy once signed in, and not before", async () => {
  const { signIn } = await setup();
  expect(fakeHub.connections).toHaveLength(0);

  await signIn();

  expect(fakeHub.connections).toHaveLength(1);
  expect(fakeHub.last.url).toBe("/backend/api/hubs/notifications");
  expect(fakeHub.last.start).toHaveBeenCalledTimes(1);
});

test("tries WebSockets, then long polling (not Server-Sent Events, which the proxy holds back), without cookies", async () => {
  const { signIn } = await setup();
  await signIn();

  const { HttpTransportType } = await import("@microsoft/signalr");
  expect(fakeHub.last.options.transport).toBe(HttpTransportType.WebSockets | HttpTransportType.LongPolling);
  expect(fakeHub.last.options.withCredentials).toBe(false);
});

test("hands each signal to the latest callback without reconnecting", async () => {
  const first = vi.fn();
  const second = vi.fn();
  let current = first;
  const store = makeStore();
  store.dispatch(signedIn(session(tokenExpiringIn(1800))));
  const { rerender } = await renderHook(() => useNotificationsHub(current), {
    wrapper: ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>,
  });

  current = second;
  await rerender();
  fakeHub.last.signal("Added", true);

  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledWith({ kind: "Added", broadcast: true });
  expect(fakeHub.connections).toHaveLength(1);
});

test("gives the hub the session's token, and a fresh one after it expired", async () => {
  const { signIn, store } = await setup();
  const valid = tokenExpiringIn(1800);
  await signIn(valid);
  await expect(fakeHub.last.options.accessTokenFactory!()).resolves.toBe(valid);

  const renewed = tokenExpiringIn(1800);
  const refreshes = vi.spyOn(window, "fetch").mockImplementation(async () => Response.json(session(renewed)));
  const expired = tokenExpiringIn(-5);
  store.dispatch(signedIn(session(expired)));

  await expect(fakeHub.last.options.accessTokenFactory!()).resolves.toBe(renewed);
  await expect(fakeHub.last.options.accessTokenFactory!()).resolves.toBe(renewed);
  expect(refreshes).toHaveBeenCalledTimes(1);
});

test("a token that is only refreshed keeps the same connection", async () => {
  const { signIn, store } = await setup();
  await signIn();

  applySessionRefresh(store, store.getState().session, session(tokenExpiringIn(1800)));

  expect(fakeHub.connections).toHaveLength(1);
  expect(fakeHub.last.stop).not.toHaveBeenCalled();
});

test("stops when signed out, and another account gets a connection of its own", async () => {
  const { signIn, act, store } = await setup();
  await signIn(tokenExpiringIn(1800, "1"));
  const first = fakeHub.last;

  await act(() => void store.dispatch(signedOut()));
  expect(first.stop).toHaveBeenCalledTimes(1);
  expect(fakeHub.connections).toHaveLength(1);

  await signIn(tokenExpiringIn(1800, "2"));
  expect(fakeHub.connections).toHaveLength(2);
  expect(fakeHub.last.start).toHaveBeenCalledTimes(1);
});

test("signing in as someone else without signing out first replaces the connection", async () => {
  const { signIn } = await setup();
  await signIn(tokenExpiringIn(1800, "1"));
  const first = fakeHub.last;

  await signIn(tokenExpiringIn(1800, "2"));

  expect(first.stop).toHaveBeenCalledTimes(1);
  expect(fakeHub.connections).toHaveLength(2);
});

test("stops when the page leaves", async () => {
  const { signIn, unmount } = await setup();
  await signIn();

  await unmount();

  expect(fakeHub.last.stop).toHaveBeenCalledTimes(1);
});

test("a failed refresh signs out and stops the connection", async () => {
  const { signIn, store } = await setup();
  await signIn();
  store.dispatch(signedIn(session(tokenExpiringIn(-5))));
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json({ status: 401, code: "session_expired" }, { status: 401 }));

  await expect(fakeHub.last.options.accessTokenFactory!()).rejects.toThrow();

  await vi.waitUntil(() => fakeHub.last.stop.mock.calls.length === 1);
  expect(store.getState().session.status).toBe("anonymous");
});

test("retries without end while the connection cannot start, backing off to 30 seconds", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  fakeHub.failingStarts = 8;
  const { signIn } = await setup();
  await signIn();
  const connection = fakeHub.last;
  expect(connection.start).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(1000);
  expect(connection.start).toHaveBeenCalledTimes(2);

  // Eight failures in, every wait is 30 s at most: the ninth start comes within that, and it is the one that works.
  await vi.advanceTimersByTimeAsync(30_000 * 8);
  expect(connection.start).toHaveBeenCalledTimes(9);
  await vi.advanceTimersByTimeAsync(30_000 * 3);
  expect(connection.start).toHaveBeenCalledTimes(9);
});

test("the library's own retries never stop, and wait 30 seconds at most", async () => {
  const { signIn } = await setup();
  await signIn();
  const { policy } = fakeHub.last;
  const wait = (previousRetryCount: number) =>
    policy!.nextRetryDelayInMilliseconds({ previousRetryCount, elapsedMilliseconds: 0, retryReason: new Error("lost") });

  expect(wait(0)).toBeLessThanOrEqual(1000);
  for (const retries of [5, 20, 1000, 100_000]) {
    expect(wait(retries)).toBeGreaterThanOrEqual(15_000);
    expect(wait(retries)).toBeLessThanOrEqual(30_000);
  }
});

test("starts again after the server closed the connection, as the token ran out", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const { signIn } = await setup();
  await signIn();
  const connection = fakeHub.last;

  connection.close();
  await vi.advanceTimersByTimeAsync(1000);

  expect(connection.start).toHaveBeenCalledTimes(2);
});

test("does not start again once stopped", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  fakeHub.failingStarts = 1;
  const { signIn, unmount } = await setup();
  await signIn();
  const connection = fakeHub.last;

  await unmount();
  await vi.advanceTimersByTimeAsync(60_000);

  expect(connection.start).toHaveBeenCalledTimes(1);
});
