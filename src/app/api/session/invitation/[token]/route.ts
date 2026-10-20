import type { AuthTokens } from "@/shared/api/generated/portalApi";
import { callBackend, forwardProblem, storeSession } from "@/shared/session/server";

/**
 * Accepts an invitation: forwards the new account (full name, username, password) to Portal.BE, which creates it and
 * answers as a sign-in does, and keeps the refresh token in the httpOnly cookie, as POST /api/session does.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const response = await callBackend(`/api/Invitations/accept/${encodeURIComponent(token)}`, {
    method: "POST",
    body: await request.text(),
  });

  if (!response.ok) return forwardProblem(response);

  return Response.json(await storeSession((await response.json()) as AuthTokens));
}
