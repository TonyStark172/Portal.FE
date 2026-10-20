import { backendUrl } from "../config/backend";
import { refreshSession } from "../session/sessionClient";
import { signedOut } from "../session/sessionSlice";
import { applySessionRefresh, wasRotated, type SessionStore } from "../session/sessionRotation";
import { getStoredLocale } from "../i18n/locale";
export type { SessionStore } from "../session/sessionRotation";

/**
 * GETs a Portal.BE resource that needs the access token but cannot go through RTK Query (images, downloads).
 * Like baseQueryWithReauth: on 401 the session is refreshed once and the request retried, so an image or
 * attachment still loads after the access token expired while the tab sat idle.
 */
export async function fetchProtected(store: SessionStore, path: string, signal?: AbortSignal): Promise<Response> {
  return requestProtected(store, path, { signal });
}

/** Supports JSON mutations as well as GETs, using the shared single-flight refresh. */
export async function requestProtected(store: SessionStore, path: string, init?: RequestInit): Promise<Response> {
  const initialSession = store.getState().session;
  const initialToken = initialSession.accessToken;
  const send = () => {
    const token = store.getState().session.accessToken;
    const headers = new Headers(init?.headers);
    if (!headers.has("Accept-Language")) headers.set("Accept-Language", getStoredLocale());
    if (token) headers.set("Authorization", `Bearer ${token}`);
    else headers.delete("Authorization");
    return fetch(backendUrl(path), { ...init, headers });
  };

  const response = await send();
  if (response.status !== 401) return response;
  const cancelled = () => new DOMException("Session changed while the request was pending", "AbortError");
  const currentSession = store.getState().session;
  if (currentSession !== initialSession && !wasRotated(initialSession, currentSession)) throw cancelled();
  if (initialToken === null) return response;

  if (currentSession === initialSession) {
    let refreshed: Awaited<ReturnType<typeof refreshSession>>;
    try {
      refreshed = await refreshSession();
    } catch {
      if (store.getState().session !== initialSession) throw cancelled();
      store.dispatch(signedOut());
      return response;
    }
    // A sibling may have applied the same single-flight refresh. Never revive a logged-out
    // session or replay an old mutation under a newly signed-in account.
    applySessionRefresh(store, initialSession, refreshed);
  }

  init?.signal?.throwIfAborted();
  const retrySession = store.getState().session;
  const retried = await send();
  if (retried.status === 401) {
    if (store.getState().session !== retrySession) throw cancelled();
    store.dispatch(signedOut());
  }
  return retried;
}
