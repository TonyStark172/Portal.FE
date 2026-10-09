import type { Store } from "@reduxjs/toolkit";
import { backendUrl } from "../config/backend";
import { refreshSession } from "../session/sessionClient";
import { signedIn, signedOut, type SessionState } from "../session/sessionSlice";

type SessionStore = Pick<Store<{ session: SessionState }>, "getState" | "dispatch">;

/**
 * GETs a Portal.BE resource that needs the access token but cannot go through RTK Query (images, downloads).
 * Like baseQueryWithReauth: on 401 the session is refreshed once and the request retried, so an image or
 * attachment still loads after the access token expired while the tab sat idle.
 */
export async function fetchProtected(store: SessionStore, path: string, signal?: AbortSignal): Promise<Response> {
  const send = () => {
    const token = store.getState().session.accessToken;
    return fetch(backendUrl(path), { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal });
  };

  const response = await send();
  if (response.status !== 401 || store.getState().session.accessToken === null) return response;

  try {
    store.dispatch(signedIn(await refreshSession()));
  } catch {
    store.dispatch(signedOut());
    return response;
  }

  return send();
}
