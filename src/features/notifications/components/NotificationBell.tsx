"use client";

import { useCallback, useEffect, useRef } from "react";
import { useStore } from "react-redux";
import { Badge, Button } from "@heroui/react";
import { Bell } from "@gravity-ui/icons";
import { useAppDispatch } from "@/core/hooks";
import type { RootState } from "@/core/store";
import { baseApi } from "@/shared/api/baseApi";
import { useGetUnreadNotificationCountQuery } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { isSameLogin, useLogin } from "@/shared/session/login";
import { formatUnread, notificationsApi, unreadCountTag, type NotificationSignal } from "../api";
import { useNotificationsHub } from "../hooks/useNotificationsHub";

/** A signal for the whole company arrives everywhere at once: each page waits a random time up to this before reading. */
const BROADCAST_SPREAD_MS = 10_000;

/** The bell in the top bar, with the count of unread notifications on its corner, kept current by the hub. */
export function NotificationBell() {
  const { t } = useLocale();
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const login = useLogin();
  // `currentData`: unlike `data`, it is gone once the query is skipped, as when the session ends.
  const { currentData: count = 0 } = useGetUnreadNotificationCountQuery(undefined, { skip: login === null });
  const pendingRead = useRef<ReturnType<typeof setTimeout>>(undefined);

  const readCount = useCallback(() => void dispatch(notificationsApi.util.invalidateTags([unreadCountTag])), [dispatch]);

  // Whatever the signal says changed, the count is read again rather than worked out. Reading just once covers every
  // broadcast that arrives while one is waiting.
  const onSignal = useCallback(
    ({ broadcast }: NotificationSignal) => {
      if (!broadcast) return readCount();
      if (pendingRead.current !== undefined) return;
      pendingRead.current = setTimeout(() => {
        pendingRead.current = undefined;
        readCount();
      }, Math.random() * BROADCAST_SPREAD_MS);
    },
    [readCount],
  );
  useNotificationsHub(onSignal);
  useEffect(() => () => clearTimeout(pendingRead.current), []);

  // The next account to sign in must not find this one's count or notifications in the cache. Signing out through the
  // menu already empties it; this also covers a session that ended another way.
  useEffect(() => {
    if (login === null) return;
    return () => {
      if (!isSameLogin(login, store.getState().session)) dispatch(baseApi.util.resetApiState());
    };
  }, [login, store, dispatch]);

  const unread = formatUnread(count);
  const label = unread ? t("notifications.bellUnread").replace("{count}", String(count)) : t("common.notifications");

  return (
    <Badge.Anchor>
      <Button isIconOnly aria-label={label} variant="ghost">
        <Bell className="size-4" />
      </Button>
      {unread && (
        <Badge aria-hidden color="danger" size="sm">
          {unread}
        </Badge>
      )}
    </Badge.Anchor>
  );
}
