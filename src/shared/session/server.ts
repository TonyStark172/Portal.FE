import "server-only";
import { cookies } from "next/headers";
import type { AuthTokens } from "../api/generated/portalApi";
import { ErrorCodes } from "../api/problem";
import { SESSION_ENDPOINT, type SessionInfo } from "./types";

/**
 * Server-side helpers for the session route handlers (src/app/api/session).
 * They talk to Portal.BE and keep the refresh token in an httpOnly cookie that
 * JavaScript in the browser cannot read.
 */

const REFRESH_COOKIE = "portal_refresh_token";
const portalApiUrl = process.env.PORTAL_API_URL ?? "http://localhost:5128";

export async function callBackend(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${portalApiUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
      cache: "no-store",
    });
  } catch {
    return problemResponse(503, ErrorCodes.network, "Không kết nối được tới máy chủ. Vui lòng thử lại sau.");
  }
}

/** Stores the refresh token and returns only what the browser needs. */
export async function storeSession(tokens: AuthTokens): Promise<SessionInfo> {
  const cookieStore = await cookies();
  cookieStore.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    // Only the session route handlers ever receive the refresh token.
    path: SESSION_ENDPOINT,
    expires: new Date(tokens.refreshTokenExpiresAt),
  });

  return { accessToken: tokens.accessToken, accessTokenExpiresAt: tokens.accessTokenExpiresAt };
}

export async function readRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

export async function clearSession(): Promise<void> {
  (await cookies()).set(REFRESH_COOKIE, "", { path: SESSION_ENDPOINT, maxAge: 0 });
}

/** Passes a back-end error (problem details) through unchanged. */
export async function forwardProblem(response: Response): Promise<Response> {
  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/problem+json" },
  });
}

export function problemResponse(status: number, code: string, detail: string): Response {
  return Response.json({ status, code, detail }, { status, headers: { "Content-Type": "application/problem+json" } });
}
