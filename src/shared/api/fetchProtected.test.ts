import { expect, test, vi } from "vitest";
import { makeStore } from "@/core/store";
import { signedIn, signedOut } from "@/shared/session/sessionSlice";
import { baseQueryWithReauth } from "./baseQuery";
import { requestProtected, type SessionStore } from "./fetchProtected";

/** A JSON request through requestProtected; a failed status is thrown as "HTTP <status>". */
async function request(path: string, store: SessionStore, init?: RequestInit) {
  const response = await requestProtected(store, path, init);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

test("protected requests refresh an expired token and preserve the mutation body on retry", async () => {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "expired", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  const requests: RequestInit[] = [];
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async (url, init) => {
    if (String(url) === "/api/session/refresh") return Response.json({ accessToken: "renewed", accessTokenExpiresAt: "2099-01-01T00:00:00Z" });
    requests.push(init!);
    return new Headers(init?.headers).get("Authorization") === "Bearer renewed" ? Response.json({ id: 7 }) : new Response(null, { status: 401 });
  });
  try {
    await expect(request("/api/Meetings/bookings", store, { method: "POST", body: '{"mutationId":"same-key"}' })).resolves.toEqual({ id: 7 });
    expect(requests).toHaveLength(2);
    for (const request of requests) expect(request).toMatchObject({ method: "POST", body: '{"mutationId":"same-key"}' });
    expect(store.getState().session.accessToken).toBe("renewed");
  } finally { fetches.mockRestore(); }
});

test("a rejected refresh signs out instead of retaining a stale authenticated session", async () => {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "expired", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async () => new Response(null, { status: 401 }));
  try {
    await expect(request("/api/Meetings", store)).rejects.toThrow("HTTP 401");
    expect(store.getState().session.status).toBe("anonymous");
    expect(fetches).toHaveBeenCalledTimes(2);
  } finally { fetches.mockRestore(); }
});

test("concurrent protected requests share one refresh and both retry with the new token", async () => {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "expired", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  let refreshes = 0;
  let renewedRequests = 0;
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async (url, init) => {
    if (String(url) === "/api/session/refresh") {
      refreshes++;
      return Response.json({ accessToken: "renewed", accessTokenExpiresAt: "2099-01-01T00:00:00Z" });
    }
    if (new Headers(init?.headers).get("Authorization") === "Bearer renewed") { renewedRequests++; return Response.json([]); }
    return new Response(null, { status: 401 });
  });
  try {
    await expect(Promise.all([request("/api/Meetings", store), request("/api/Meetings/audience/departments", store)])).resolves.toEqual([[], []]);
    expect(refreshes).toBe(1);
    expect(renewedRequests).toBe(2);
  } finally { fetches.mockRestore(); }
});

test("a delayed initial 401 reuses a sibling refresh without refreshing again", async () => {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "expired", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  let resolveDelayed!: (response: Response) => void;
  const delayed = new Promise<Response>(resolve => { resolveDelayed = resolve; });
  let refreshes = 0;
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async (url, init) => {
    if (String(url) === "/api/session/refresh") { refreshes++; return Response.json({ accessToken: "renewed", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }); }
    if (new Headers(init?.headers).get("Authorization") === "Bearer renewed") return Response.json([]);
    return String(url).includes("departments") ? new Response(null, { status: 401 }) : delayed;
  });
  const result = request("/api/Meetings", store).catch(error => error);
  try {
    await expect(request("/api/Meetings/audience/departments", store)).resolves.toEqual([]);
    resolveDelayed(new Response(null, { status: 401 }));
    expect(await result).toEqual([]);
    expect(refreshes).toBe(1);
  } finally { resolveDelayed(new Response(null, { status: 401 })); await result; fetches.mockRestore(); }
});

test("a delayed protected 401 recognizes refresh applied by RTK Query", async () => {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "expired", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  let resolveDelayed!: (response: Response) => void;
  const delayed = new Promise<Response>(resolve => { resolveDelayed = resolve; });
  let refreshes = 0;
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async (url, init) => {
    if (String(url) === "/api/session/refresh") { refreshes++; return Response.json({ accessToken: "renewed", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }); }
    const request = url instanceof Request ? url : null;
    if (new Headers(request?.headers ?? init?.headers).get("Authorization") === "Bearer renewed") return Response.json([]);
    return request ? new Response(null, { status: 401 }) : delayed;
  });
  const result = request("/api/Meetings", store).catch(error => error);
  try {
    const query = await baseQueryWithReauth("/api/Users", {getState: store.getState, dispatch: store.dispatch, signal: new AbortController().signal, abort: () => {}, endpoint: "users", type: "query", extra: undefined}, {});
    expect(query).toMatchObject({data: []});
    resolveDelayed(new Response(null, { status: 401 }));
    expect(await result).toEqual([]);
    expect(refreshes).toBe(1);
  } finally { resolveDelayed(new Response(null, { status: 401 })); await result; fetches.mockRestore(); }
});

test("a protected request still unauthorized after refresh signs out without looping", async () => {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "expired", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async url => String(url) === "/api/session/refresh"
    ? Response.json({ accessToken: "renewed", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }) : new Response(null, { status: 401 }));
  try {
    await expect(request("/api/Meetings", store)).rejects.toThrow("HTTP 401");
    expect(store.getState().session.status).toBe("anonymous");
    expect(fetches).toHaveBeenCalledTimes(3);
  } finally { fetches.mockRestore(); }
});

test.each(["logout", "login"])("refresh must not resurrect or replay a mutation after %s", async action => {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "expired", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  let resolveRefresh!: (response: Response) => void;
  const pendingRefresh = new Promise<Response>(resolve => { resolveRefresh = resolve; });
  let requests = 0;
  let refreshing = false;
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async url => {
    if (String(url) === "/api/session/refresh") { refreshing = true; return pendingRefresh; }
    requests++; return requests === 1 ? new Response(null, { status: 401 }) : Response.json({ id: 7 });
  });
  const result = request("/api/Meetings/bookings", store, { method: "POST", body: '{}' }).catch(error => error);
  try {
    await vi.waitFor(() => expect(refreshing).toBe(true));
    if (action === "logout") store.dispatch(signedOut());
    else store.dispatch(signedIn({ accessToken: "different-user", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    resolveRefresh(Response.json({ accessToken: "renewed-old-user", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    expect(await result).toMatchObject({ name: "AbortError" });
    expect(requests).toBe(1);
    expect(store.getState().session.accessToken).toBe(action === "logout" ? null : "different-user");
  } finally { resolveRefresh(new Response(null, { status: 401 })); await result; fetches.mockRestore(); }
});

test("a stale retry 401 does not sign out a newer session", async () => {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "expired", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  let resolveRetry!: (response: Response) => void;
  const pendingRetry = new Promise<Response>(resolve => { resolveRetry = resolve; });
  let requests = 0;
  const fetches = vi.spyOn(window, "fetch").mockImplementation(async url => {
    if (String(url) === "/api/session/refresh") return Response.json({ accessToken: "renewed", accessTokenExpiresAt: "2099-01-01T00:00:00Z" });
    requests++; return requests === 1 ? new Response(null, { status: 401 }) : pendingRetry;
  });
  const result = request("/api/Meetings", store).catch(error => error);
  try {
    await vi.waitFor(() => expect(requests).toBe(2));
    store.dispatch(signedIn({ accessToken: "new-session", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
    resolveRetry(new Response(null, { status: 401 }));
    expect(await result).toMatchObject({ name: "AbortError" });
    expect(store.getState().session.accessToken).toBe("new-session");
  } finally { resolveRetry(new Response(null, { status: 401 })); await result; fetches.mockRestore(); }
});
