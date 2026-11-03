"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "react-redux";
import { Badge, Button, Popover } from "@heroui/react";
import { Bell } from "@gravity-ui/icons";
import { useAppDispatch } from "@/core/hooks";
import type { RootState } from "@/core/store";
import { baseApi } from "@/shared/api/baseApi";
import { useGetUnreadNotificationCountQuery } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { isSameLogin, useLogin } from "@/shared/session/login";
import { formatUnread, notificationsApi, unreadCountTag, type NotificationSignal, type NotificationSignalKind } from "../api";
import { NotificationSignalsContext, useSignalSource } from "../hooks/useNotificationSignals";
import { useNotificationsHub } from "../hooks/useNotificationsHub";
import { NotificationPanel } from "./NotificationPanel";

/** A signal for the whole company arrives everywhere at once: each page waits a random time up to this before reading. */
const BROADCAST_SPREAD_MS = 10_000;

/**
 * The bell in the top bar, with the count of unread notifications on its corner, kept current by the hub. It opens the
 * panel under it (the whole screen on a phone) and passes it the signals, as the page has one connection only.
 */
export function NotificationBell() {
  const { t } = useLocale();
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const login = useLogin();
  // `currentData`: unlike `data`, it is gone once the query is skipped, as when the session ends.
  const { currentData: count = 0 } = useGetUnreadNotificationCountQuery(undefined, { skip: login === null });
  const [isOpen, setOpen] = useState(false);
  const signals = useSignalSource();
  const pendingRead = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingKinds = useRef(new Set<NotificationSignalKind>());

  const readCount = useCallback(() => void dispatch(notificationsApi.util.invalidateTags([unreadCountTag])), [dispatch]);

  // Whatever the signal says changed, the count is read again rather than worked out. Reading just once covers every
  // broadcast that arrives while one is waiting; the open panel hears all the kinds that came, when that read is made.
  const onSignal = useCallback(
    ({ kind, broadcast }: NotificationSignal) => {
      if (!broadcast) {
        readCount();
        return signals.emit(kind);
      }
      pendingKinds.current.add(kind);
      if (pendingRead.current !== undefined) return;
      pendingRead.current = setTimeout(() => {
        pendingRead.current = undefined;
        readCount();
        const kinds = [...pendingKinds.current];
        pendingKinds.current.clear();
        kinds.forEach(signals.emit);
      }, Math.random() * BROADCAST_SPREAD_MS);
    },
    [readCount, signals],
  );
  useNotificationsHub(onSignal);
  // Left as it was, the stale handle would make every later broadcast think a read is already on its way.
  useEffect(
    () => () => {
      clearTimeout(pendingRead.current);
      pendingRead.current = undefined;
      pendingKinds.current.clear();
    },
    [],
  );

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
    <NotificationSignalsContext.Provider value={signals.subscribe}>
      <Popover isOpen={isOpen} onOpenChange={setOpen}>
        <Badge.Anchor>
          <Button isIconOnly aria-label={label} variant="ghost">
            <Bell className="size-4" />
          </Button>
          {unread && (
            // The danger red moved away from the number's colour (the number is light on most themes' reds, dark on one): their own reds leave it under 4.5:1.
            <Badge
              aria-hidden
              color="danger"
              size="sm"
              className="bg-[color-mix(in_oklab,var(--danger)_78%,oklch(from_var(--danger-foreground)_calc(1-l)_0_0))]"
            >
              {unread}
            </Badge>
          )}
        </Badge.Anchor>
        {/* From a phone's width the panel is the whole screen: the popover's own position is overridden. */}
        <Popover.Content
          placement="bottom end"
          className="w-[420px] max-w-[calc(100vw-1rem)] overflow-hidden max-sm:fixed! max-sm:inset-0! max-sm:h-dvh! max-sm:max-h-none! max-sm:w-screen! max-sm:max-w-none! max-sm:rounded-none!"
        >
          <Popover.Dialog aria-label={t("notifications.title")} className="flex max-h-[70vh] flex-col p-0 max-sm:h-full max-sm:max-h-none">
            <NotificationPanel onClose={() => setOpen(false)} />
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </NotificationSignalsContext.Provider>
  );
}
