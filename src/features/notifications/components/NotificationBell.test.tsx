import "@/app/globals.css";
import { Activity } from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { signedIn, signedOut } from "@/shared/session/sessionSlice";
import { tokenExpiringIn } from "@/shared/session/token.testing";
import { notificationsApi } from "../api";
import { fakeHub } from "../hooks/fakeHub.testing";
import { NotificationBell } from "./NotificationBell";

vi.mock("@microsoft/signalr", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@microsoft/signalr")>()),
  HubConnectionBuilder: (await import("../hooks/fakeHub.testing")).FakeHubConnectionBuilder,
}));

const session = (accessToken: string) => ({ accessToken, accessTokenExpiresAt: "2099-01-01T00:00:00Z" });

/** What the API says now: the count of whoever asks, by the token they ask with. */
const server = { counts: {} as Record<string, number>, countRequests: 0, listRequests: 0 };
const tokenOf = (init?: RequestInit) => new Headers(init?.headers).get("Authorization")?.replace("Bearer ", "") ?? "";

function stubApi() {
  vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    const headers = init?.headers ?? (input instanceof Request ? input.headers : undefined);
    if (url.includes("/api/Notifications/unread-count")) {
      server.countRequests++;
      return Response.json(server.counts[tokenOf({ headers })] ?? 0);
    }
    if (url.includes("/api/Notifications")) {
      server.listRequests++;
      return Response.json({ items: [], nextCursor: null });
    }
    return new Response(null, { status: 404 });
  });
}

function renderBell(token = tokenExpiringIn(1800)) {
  server.counts[token] ??= 0;
  const store = makeStore();
  store.dispatch(signedIn(session(token)));
  const screen = render(
    <Provider store={store}>
      <NotificationBell />
    </Provider>,
  );
  return screen.then((rendered) => ({ ...rendered, store, token }));
}

beforeEach(() => {
  fakeHub.reset();
  server.counts = {};
  server.countRequests = 0;
  server.listRequests = 0;
  stubApi();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the count on the bell", () => {
  test("shows nothing at 0, the number up to 9, and 9+ above", async () => {
    const token = tokenExpiringIn(1800);
    const cases: [number, string | null][] = [[0, null], [1, "1"], [9, "9"], [10, "9+"], [250, "9+"]];
    for (const [count, shown] of cases) {
      server.counts[token] = count;
      const screen = await renderBell(token);
      await vi.waitUntil(() => server.countRequests > 0);
      if (shown) await expect.element(screen.getByText(shown, { exact: true })).toBeVisible();
      else await expect.element(screen.getByRole("button", { name: "Thông báo", exact: true })).toBeVisible();
      expect(screen.container.textContent?.trim() ?? "").toBe(shown ?? "");
      await screen.unmount();
      server.countRequests = 0;
    }
  });

  test("names the unread count for screen readers", async () => {
    const token = tokenExpiringIn(1800);
    server.counts[token] = 3;
    const screen = await renderBell(token);

    await expect.element(screen.getByRole("button", { name: "Thông báo, 3 chưa đọc" })).toBeVisible();
  });

  test("names the real count when the badge says 9+", async () => {
    const token = tokenExpiringIn(1800);
    server.counts[token] = 25;
    const screen = await renderBell(token);

    await expect.element(screen.getByRole("button", { name: "Thông báo, 25 chưa đọc" })).toBeVisible();
    await expect.element(screen.getByText("9+")).toBeVisible();
  });
});

describe("staying current", () => {
  test("a signal re-reads the count", async () => {
    const screen = await renderBell();
    await vi.waitUntil(() => server.countRequests === 1);
    server.counts[screen.token] = 4;

    fakeHub.last.signal("Added");

    await expect.element(screen.getByRole("button", { name: "Thông báo, 4 chưa đọc" })).toBeVisible();
    expect(server.countRequests).toBe(2);
  });

  test.each(["Added", "Updated", "Removed", "Read"])("a %s signal re-reads it too", async (kind) => {
    await renderBell();
    await vi.waitUntil(() => server.countRequests === 1);

    fakeHub.last.signal(kind);

    await vi.waitUntil(() => server.countRequests === 2);
  });

  test("a broadcast waits up to ten seconds before re-reading, so the company does not all read at once", async () => {
    await renderBell();
    await vi.waitUntil(() => server.countRequests === 1);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.spyOn(Math, "random").mockReturnValue(0.999);

    fakeHub.last.signal("Added", true);
    await vi.advanceTimersByTimeAsync(0);
    expect(server.countRequests).toBe(1);
    await vi.advanceTimersByTimeAsync(9000);
    expect(server.countRequests).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(server.countRequests).toBe(2);
  });

  test("a broadcast that drew no wait re-reads at once", async () => {
    await renderBell();
    await vi.waitUntil(() => server.countRequests === 1);
    vi.spyOn(Math, "random").mockReturnValue(0);

    fakeHub.last.signal("Added", true);

    await vi.waitUntil(() => server.countRequests === 2);
  });

  test("a broadcast still waiting when the bell leaves does not read", async () => {
    const { unmount } = await renderBell();
    await vi.waitUntil(() => server.countRequests === 1);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    fakeHub.last.signal("Added", true);

    await unmount();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(server.countRequests).toBe(1);
  });

  test("a broadcast is still read after the bell's effects ran again, as when it was hidden and shown", async () => {
    const token = tokenExpiringIn(1800);
    server.counts[token] = 0;
    const store = makeStore();
    store.dispatch(signedIn(session(token)));
    const view = (mode: "visible" | "hidden") => (
      <Provider store={store}>
        <Activity mode={mode}>
          <NotificationBell />
        </Activity>
      </Provider>
    );
    const screen = await render(view("visible"));
    await vi.waitUntil(() => server.countRequests === 1);
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    fakeHub.last.signal("Added", true);

    await screen.rerender(view("hidden"));
    await screen.rerender(view("visible"));
    await vi.waitUntil(() => fakeHub.connections.length === 2);
    random.mockReturnValue(0);
    fakeHub.last.signal("Added", true);

    await vi.waitUntil(() => server.countRequests === 2);
  });

  test("re-reads the count and a loaded list when the connection comes back", async () => {
    const { store } = await renderBell();
    const list = store.dispatch(notificationsApi.endpoints.getNotificationPages.initiate({ unreadOnly: false }));
    await list;
    await vi.waitUntil(() => server.countRequests === 1);
    expect(server.listRequests).toBe(1);

    fakeHub.last.reconnect();

    await vi.waitUntil(() => server.countRequests === 2 && server.listRequests === 2);
    list.unsubscribe();
  });

  test("re-reads them when the tab comes back, not when it goes away", async () => {
    await renderBell();
    await vi.waitUntil(() => server.countRequests === 1);
    const visibility = vi.spyOn(document, "visibilityState", "get");

    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(server.countRequests).toBe(1);

    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitUntil(() => server.countRequests === 2);
  });

  test("a signal does not read the list, only the count", async () => {
    const { store } = await renderBell();
    const list = store.dispatch(notificationsApi.endpoints.getNotificationPages.initiate({ unreadOnly: false }));
    await list;
    await vi.waitUntil(() => server.countRequests === 1);

    fakeHub.last.signal("Added");

    await vi.waitUntil(() => server.countRequests === 2);
    expect(server.listRequests).toBe(1);
    list.unsubscribe();
  });
});

describe("signing out and in", () => {
  test("stops the connection, and the next account starts clean", async () => {
    const owner = tokenExpiringIn(1800, "1");
    server.counts[owner] = 7;
    const screen = await renderBell(owner);
    const { store } = screen;
    await expect.element(screen.getByText("7")).toBeVisible();
    const list = store.dispatch(notificationsApi.endpoints.getNotificationPages.initiate({ unreadOnly: false }));
    await list;
    list.unsubscribe();
    const first = fakeHub.last;

    store.dispatch(signedOut());

    await vi.waitUntil(() => first.stop.mock.calls.length === 1);
    expect(Object.keys(store.getState().api.queries).filter((key) => /Notification/.test(key))).toEqual([]);
    await expect.element(screen.getByRole("button", { name: "Thông báo", exact: true })).toBeVisible();

    const other = tokenExpiringIn(1800, "2");
    server.counts[other] = 0;
    store.dispatch(signedIn(session(other)));

    await vi.waitUntil(() => fakeHub.connections.length === 2);
    await vi.waitUntil(() => store.getState().api.queries["getUnreadNotificationCount(undefined)"]?.status === "fulfilled");
    expect(store.getState().api.queries["getUnreadNotificationCount(undefined)"]?.data).toBe(0);
    expect(Object.keys(store.getState().api.queries).filter((key) => /Notification/.test(key))).toEqual([
      "getUnreadNotificationCount(undefined)",
    ]);
  });

  test("a token that is only refreshed does not wipe the count", async () => {
    const owner = tokenExpiringIn(1800, "1");
    server.counts[owner] = 7;
    const screen = await renderBell(owner);
    await expect.element(screen.getByText("7")).toBeVisible();

    const { applySessionRefresh } = await import("@/shared/session/sessionRotation");
    const renewed = tokenExpiringIn(1800, "1");
    server.counts[renewed] = 7;
    applySessionRefresh(screen.store, screen.store.getState().session, session(renewed));

    await expect.element(screen.getByText("7")).toBeVisible();
    expect(fakeHub.connections).toHaveLength(1);
    expect(screen.store.getState().api.queries["getUnreadNotificationCount(undefined)"]?.data).toBe(7);
  });
});
