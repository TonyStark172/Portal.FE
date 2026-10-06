import type { AuthTokens } from "@/shared/api/generated/portalApi";
import { ErrorCodes } from "@/shared/api/problem";
import {
  callBackend,
  clearSession,
  forwardProblem,
  problemResponse,
  readRefreshToken,
  storeSession,
} from "@/shared/session/server";

/** Exchanges the refresh-token cookie for a new access token (the refresh token is rotated). */
export async function POST() {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) {
    return problemResponse(401, ErrorCodes.sessionExpired, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }

  const response = await callBackend("/api/Auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    if (response.status === 401) await clearSession();
    return forwardProblem(response);
  }

  return Response.json(await storeSession((await response.json()) as AuthTokens));
}
