"use client";

import { useState } from "react";
import { useSelector } from "react-redux";
import { wasRotated } from "./sessionRotation";
import type { SessionState } from "./sessionSlice";

/** Whether `session` is `login` or that login with its access token renewed (refreshing is not signing in again). */
export function isSameLogin(login: SessionState, session: SessionState): boolean {
  return session.status === "authenticated" && (session === login || wasRotated(login, session));
}

/**
 * The session a login began with, which stays the same while the access token is only renewed. Signing out and in
 * again, even as the same person, gives another one; null while nobody is signed in. For things tied to one login,
 * such as a connection kept open for it.
 */
export function useLogin(): SessionState | null {
  const session = useSelector((state: { session: SessionState }) => state.session);
  const [login, setLogin] = useState<SessionState | null>(null);

  const current = session.status !== "authenticated" ? null : login !== null && isSameLogin(login, session) ? login : session;
  if (current !== login) setLogin(current);
  return current;
}
