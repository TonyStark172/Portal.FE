import { ApiProblemError, ErrorCodes, readProblem } from "../api/problem";
import { SESSION_ENDPOINT, SESSION_REFRESH_ENDPOINT, type Credentials, type SessionInfo } from "./types";

/**
 * Browser-side calls to the session route handlers. The refresh token never reaches
 * JavaScript: it lives in an httpOnly cookie set by those handlers.
 */

async function postJson(url: string, init: RequestInit): Promise<SessionInfo> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  }).catch(() => null);

  if (!response) {
    throw new ApiProblemError({
      status: 0,
      code: ErrorCodes.network,
      detail: "Không kết nối được tới máy chủ. Vui lòng kiểm tra mạng và thử lại.",
    });
  }

  if (!response.ok) throw new ApiProblemError(await readProblem(response));

  return (await response.json()) as SessionInfo;
}

export const startSession = (credentials: Credentials) =>
  postJson(SESSION_ENDPOINT, { method: "POST", body: JSON.stringify(credentials) });

let refreshInFlight: Promise<SessionInfo> | null = null;

/**
 * Exchanges the refresh cookie for a new access token.
 *
 * Refresh tokens are single-use: presenting one twice makes the back end revoke every
 * session. So concurrent callers share one request, and a Web Lock serialises refreshes
 * across browser tabs (the next tab then sends the cookie that was just rotated).
 */
export function refreshSession(): Promise<SessionInfo> {
  refreshInFlight ??= withCrossTabLock(() =>
    postJson(SESSION_REFRESH_ENDPOINT, { method: "POST" }),
  ).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function endSession(accessToken: string | null): Promise<void> {
  await fetch(SESSION_ENDPOINT, {
    method: "DELETE",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  }).catch(() => undefined);
}

async function withCrossTabLock<T>(action: () => Promise<T>): Promise<T> {
  return typeof navigator !== "undefined" && navigator.locks
    ? await navigator.locks.request("portal-session-refresh", action)
    : await action();
}
