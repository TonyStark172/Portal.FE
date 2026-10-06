import type { AuthTokens } from "@/shared/api/generated/portalApi";
import { callBackend, clearSession, forwardProblem, readRefreshToken, storeSession } from "@/shared/session/server";

/** Sign in: forwards the credentials to Portal.BE and keeps the refresh token in an httpOnly cookie. */
export async function POST(request: Request) {
  const response = await callBackend("/api/Auth/login", {
    method: "POST",
    body: await request.text(),
  });

  if (!response.ok) return forwardProblem(response);

  return Response.json(await storeSession((await response.json()) as AuthTokens));
}

/** Sign out: revokes the refresh token on Portal.BE (best effort) and clears the cookie. */
export async function DELETE(request: Request) {
  const refreshToken = await readRefreshToken();
  const authorization = request.headers.get("Authorization");

  if (refreshToken && authorization) {
    await callBackend("/api/Auth/logout", {
      method: "POST",
      headers: { Authorization: authorization },
      body: JSON.stringify({ refreshToken }),
    });
  }

  await clearSession();
  return new Response(null, { status: 204 });
}
