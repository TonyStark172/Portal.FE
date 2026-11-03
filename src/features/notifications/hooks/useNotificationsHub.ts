"use client";

import { useEffect, useRef } from "react";
import { useStore } from "react-redux";
import { HttpTransportType, HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { useAppDispatch } from "@/core/hooks";
import type { RootState } from "@/core/store";
import { backendUrl } from "@/shared/config/backend";
import { freshAccessToken } from "@/shared/session/freshAccessToken";
import { useLogin } from "@/shared/session/login";
import { notificationsApi, notificationListTag, unreadCountTag, type NotificationSignal } from "../api";

const HUB_PATH = "/api/hubs/notifications";
/** The client method Portal.BE's `NotificationsHub.ChangedMethod` calls. */
const CHANGED_METHOD = "notificationsChanged";
const MAX_RETRY_DELAY_MS = 30_000;

/**
 * How long to wait after `retries` failed attempts: 1 s, 2 s, 4 s… up to 30 s, never giving up. Half of it is random,
 * so the pages of a company are not all back the second a restarted server is.
 */
function retryDelay(retries: number): number {
  const ceiling = Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** Math.min(retries, 10));
  return ceiling / 2 + (Math.random() * ceiling) / 2;
}

/**
 * Keeps a connection to the notifications hub open while someone is signed in, and hands every signal to `onSignal`.
 * The connection goes through the same-origin proxy, falling back from WebSockets to long polling, and is replaced when
 * another account signs in (a renewed access token keeps it). Server-Sent Events are left out: Next's compression holds
 * the stream back for a browser that accepts gzip, so a connection that opened would never deliver a signal. It
 * reconnects without end; after a reconnection, and when the tab comes back to the front, the count and any loaded
 * list are read again, since signals sent in the meantime were lost.
 */
export function useNotificationsHub(onSignal: (signal: NotificationSignal) => void): void {
  const store = useStore<RootState>();
  const dispatch = useAppDispatch();
  const login = useLogin();
  const latest = useRef(onSignal);
  useEffect(() => {
    latest.current = onSignal;
  });

  useEffect(() => {
    if (login === null) return;

    let stopped = false;
    // The library reports a connection stopped while it was still starting (a page leaving, strict mode's second
    // effect) as an error, which Next's overlay shows as an issue; only what goes wrong on its own is worth a line.
    const logger = { log: (level: LogLevel, message: string) => level >= LogLevel.Warning && !stopped && console.warn(message) };

    // The cookies are of no use to the hub: the token goes in the query. Without credentials a direct address works too.
    const connection = new HubConnectionBuilder()
      .withUrl(backendUrl(HUB_PATH), {
        accessTokenFactory: () => freshAccessToken(store),
        transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
        withCredentials: false,
      })
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: ({ previousRetryCount }) => retryDelay(previousRetryCount) })
      .configureLogging(logger)
      .build();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const readAgain = () => void dispatch(notificationsApi.util.invalidateTags([unreadCountTag, notificationListTag]));

    // Starting can fail (the library only retries a connection that was up), and a closed connection stays closed.
    // `failures` counts the attempts since the last time it was up; anything after the first needs a fresh read.
    const connect = async (failures = 0) => {
      while (!stopped) {
        if (failures > 0) {
          await new Promise((resolve) => (timer = setTimeout(resolve, retryDelay(failures - 1))));
          if (stopped) return;
        }
        try {
          await connection.start();
          if (failures > 0) readAgain();
          return;
        } catch {
          failures++;
        }
      }
    };

    connection.on(CHANGED_METHOD, (signal: NotificationSignal) => latest.current(signal));
    connection.onreconnected(readAgain);
    // The server ends the connection when the token runs out: the next start asks for a renewed one.
    connection.onclose(() => {
      if (!stopped) void connect(1);
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") readAgain();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    void connect();

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void connection.stop();
    };
  }, [login, store, dispatch]);
}
