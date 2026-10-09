import type { Store } from "@reduxjs/toolkit";
import { backendUrl } from "../config/backend";
import { refreshSession } from "../session/sessionClient";
import { signedIn, signedOut, type SessionState } from "../session/sessionSlice";

type SessionStore = Pick<Store<{ session: SessionState }>, "getState" | "dispatch">;

type UploadOptions = {
  /** Share of the body sent so far, from 0 to 1. */
  onProgress?: (sent: number) => void;
  signal?: AbortSignal;
};

/**
 * POSTs a form to Portal.BE with the access token and reports how much of it was sent (fetch cannot), for large
 * uploads such as videos. Like fetchProtected, a 401 refreshes the session once and sends again.
 * Resolves with the JSON body; rejects with `{ status, data }` like RTK Query, so toApiProblem reads it.
 */
export async function uploadProtected<T>(
  store: SessionStore,
  path: string,
  form: FormData,
  { onProgress, signal }: UploadOptions = {},
): Promise<T> {
  const send = () =>
    new Promise<{ status: number; data: unknown }>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", backendUrl(path));
      const token = store.getState().session.accessToken;
      if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);
      request.responseType = "json";

      request.upload.onprogress = (event) => event.lengthComputable && onProgress?.(event.loaded / event.total);
      request.onload = () => resolve({ status: request.status, data: request.response });
      request.onerror = () => reject({ status: "FETCH_ERROR", error: "Network error" });
      request.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
      signal?.addEventListener("abort", () => request.abort(), { once: true });

      request.send(form);
    });

  let response = await send();
  if (response.status === 401 && store.getState().session.accessToken !== null) {
    try {
      store.dispatch(signedIn(await refreshSession()));
    } catch {
      store.dispatch(signedOut());
      throw response;
    }
    onProgress?.(0);
    response = await send();
  }

  if (response.status >= 200 && response.status < 300) return response.data as T;
  throw response;
}
