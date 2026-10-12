import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { BACKEND_PREFIX } from "../config/backend";
import { refreshSession } from "../session/sessionClient";
import { signedOut, type SessionState } from "../session/sessionSlice";
import { applySessionRefresh, wasRotated } from "../session/sessionRotation";
import { getStoredLocale } from "../i18n/locale";

type StateWithSession = { session: SessionState };

/**
 * Query string of a request: undefined/null values are left out and an array repeats its parameter
 * (`kindIds=1&kindIds=2`, as ASP.NET binds it), so a comma inside a value stays part of it.
 */
export function serializeParams(params: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    for (const item of Array.isArray(value) ? value : [value])
      if (item !== undefined && item !== null) query.append(key, String(item));
  return query.toString();
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: BACKEND_PREFIX,
  paramsSerializer: serializeParams,
  prepareHeaders: (headers, { getState }) => {
    const { accessToken } = (getState() as StateWithSession).session;
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Accept-Language", getStoredLocale());
    return headers;
  },
});

/**
 * Sends the access token with every request. When the back end answers 401
 * (typically "token_expired"), refreshes the session once and retries the request;
 * if the refresh fails the user is signed out.
 */
export const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const initialSession = (api.getState() as StateWithSession).session;
  let result = await rawBaseQuery(args, api, extraOptions);

  const hadSession = (api.getState() as StateWithSession).session.accessToken !== null;
  if (result.error?.status !== 401 || !hadSession) return result;

  try {
    const current = (api.getState() as StateWithSession).session;
    if (current === initialSession) applySessionRefresh({ getState: () => api.getState() as StateWithSession, dispatch: api.dispatch }, initialSession, await refreshSession());
    else if (!wasRotated(initialSession, current)) return result;
    result = await rawBaseQuery(args, api, extraOptions);
  } catch {
    if ((api.getState() as StateWithSession).session === initialSession) api.dispatch(signedOut());
  }

  return result;
};
