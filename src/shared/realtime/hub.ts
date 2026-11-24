"use client";

import { useEffect, useRef } from "react";

/**
 * What Portal.BE's notifications hub sends (`NotificationsChanged`); conversation signals say which and, for typing,
 * who, and for messages which one is new or changed. The page adds one kind of its own, "Resync": the connection or the
 * tab came back, so signals may have been missed.
 */
export type HubSignal = {
  kind: string;
  broadcast: boolean;
  conversationId?: number | null;
  userId?: number | null;
  messageId?: number | null;
};

type Invoker = { invoke: (method: string, ...args: unknown[]) => Promise<unknown> };

/**
 * The page's one hub connection is owned by the notifications feature (useNotificationsHub); this lets other parts of
 * the page hear its signals and send it small things (typing), without a connection of their own.
 */
let current: Invoker | null = null;
const listeners = new Set<(signal: HubSignal) => void>();

/** Called by the owner of the connection once it is up, and with null once it is down. */
export function setHubConnection(connection: Invoker | null): void {
  current = connection;
}

/** Sends to the hub when connected; anything lost is only a hint (typing), so failures are ignored. */
export function invokeHub(method: string, ...args: unknown[]): void {
  try {
    void current?.invoke(method, ...args)?.catch(() => {});
  } catch {
    // Disconnected meanwhile: the hint is lost.
  }
}

/** Called by the owner of the connection with every signal. */
export function emitHubSignal(signal: HubSignal): void {
  listeners.forEach((listener) => listener(signal));
}

/** Calls `listener` with every hub signal while the caller is mounted. */
export function useHubSignal(listener: (signal: HubSignal) => void): void {
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => {
    const forward = (signal: HubSignal) => latest.current(signal);
    listeners.add(forward);
    return () => void listeners.delete(forward);
  }, []);
}
