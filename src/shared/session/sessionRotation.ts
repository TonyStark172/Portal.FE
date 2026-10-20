import type { Store } from "@reduxjs/toolkit";
import { signedIn, type SessionState } from "./sessionSlice";
import type { SessionInfo } from "./types";

export type SessionStore = Pick<Store<{ session: SessionState }>, "getState" | "dispatch">;
const rotations = new WeakMap<SessionState, SessionState>();

/** Recognize verified refreshes across fetch, RTK Query and uploads, never arbitrary login. */
export function wasRotated(from: SessionState, to: SessionState): boolean {
  const visited = new Set<SessionState>([from]);
  let next = rotations.get(from);
  while (next && !visited.has(next)) {
    if (next === to) return true;
    visited.add(next);
    next = rotations.get(next);
  }
  return false;
}

export function applySessionRefresh(store: SessionStore, expected: SessionState, refreshed: SessionInfo): void {
  const current = store.getState().session;
  if (current === expected) {
    store.dispatch(signedIn(refreshed));
    const updated = store.getState().session;
    if (updated !== expected) rotations.set(expected, updated);
  } else if (!wasRotated(expected, current)) {
    throw new DOMException("Session changed while the request was pending", "AbortError");
  }
}
