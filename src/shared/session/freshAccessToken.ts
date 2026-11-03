import { ApiProblemError, ErrorCodes } from "../api/problem";
import { refreshSession } from "./sessionClient";
import { applySessionRefresh, type SessionStore } from "./sessionRotation";
import { signedOut } from "./sessionSlice";

/** A token that runs out within this long is renewed before it is handed over, so it does not expire on the way. */
const RENEW_BEFORE_MS = 30_000;

/** When a token expires (its `exp` claim), or null for one the browser cannot read. */
function expiryOf(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** A refresh that failed for want of a connection or a working server says nothing about the session itself. */
function isTransient(error: unknown): boolean {
  if (!(error instanceof ApiProblemError)) return true;
  const { code, status } = error.problem;
  return code === ErrorCodes.network || status >= 500;
}

/**
 * The session's access token for something that asks for it itself and cannot retry on a 401 (a hub connection). One
 * that has expired, or is about to, goes through the same single-flight refresh as a request that got a 401. When the
 * server refuses the refresh the user is signed out, as everywhere else; when it cannot be reached the session is left
 * alone and the error thrown, for the caller to try again.
 */
export async function freshAccessToken(store: SessionStore): Promise<string> {
  const initialSession = store.getState().session;
  const token = initialSession.accessToken;
  if (token === null) return "";

  const expiry = expiryOf(token);
  if (expiry === null || expiry - Date.now() > RENEW_BEFORE_MS) return token;

  try {
    applySessionRefresh(store, initialSession, await refreshSession());
  } catch (error) {
    if (!isTransient(error) && store.getState().session === initialSession) store.dispatch(signedOut());
    throw error;
  }
  return store.getState().session.accessToken ?? "";
}
