"use client";

import { useEffect, type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { refreshSession } from "./sessionClient";
import { selectSessionStatus, signedIn, signedOut } from "./sessionSlice";

/**
 * Restores the session when the app loads: the access token only lives in memory,
 * so after a page reload it is obtained again from the refresh-token cookie.
 */
export function SessionBootstrap({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const status = useSelector(selectSessionStatus);

  useEffect(() => {
    if (status !== "unknown") return;

    // refreshSession() is single-flight, so React's double effect in development is harmless.
    refreshSession()
      .then((session) => dispatch(signedIn(session)))
      .catch(() => dispatch(signedOut()));
  }, [status, dispatch]);

  return children;
}
