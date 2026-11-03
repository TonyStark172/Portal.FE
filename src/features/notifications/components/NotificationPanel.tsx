"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Button, Tabs } from "@heroui/react";
import { Xmark } from "@gravity-ui/icons";
import { useAppDispatch } from "@/core/hooks";
import { useLoadMore } from "@/features/posts/hooks/useLoadMore";
import {
  useGetUnreadNotificationCountQuery,
  useMarkAllNotificationsReadMutation,
  type NotificationDto,
} from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { formatUnread, notificationListTag, notificationsApi, useGetNotificationPagesInfiniteQuery } from "../api";
import { useNotificationSignals } from "../hooks/useNotificationSignals";
import { NotificationRow } from "./NotificationRow";
import { NotificationSkeleton } from "./NotificationSkeleton";

type Tab = "all" | "unread";

/** Closer than this to the top of the list is the top: a new row there shows at once instead of offering a button. */
const TOP_SLACK_PX = 8;

/** The rows of all the pages read so far. A row that moved to the top meanwhile can still be on a later page: it is listed once, where it is first. */
function distinct(pages: { items: NotificationDto[] }[]): NotificationDto[] {
  const seen = new Set<number>();
  const rows: NotificationDto[] = [];
  for (const item of pages.flatMap((page) => page.items)) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    rows.push(item);
  }
  return rows;
}

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

/**
 * What the bell opens: the title and "mark all read", the tabs, and under them the list, which alone scrolls. Newest
 * first in two groups, 20 more rows read as the end comes near. It lives only while open, so each opening starts from
 * the first page. Signals from the bell keep it current: a row going away or being read is read again at once; a new or
 * changed one too while the list is at its top, else a button offers to go there and read.
 */
export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<Tab>("all");
  const [hasNew, setHasNew] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  const { currentData: count = 0 } = useGetUnreadNotificationCountQuery();
  const [markAllRead] = useMarkAllNotificationsReadMutation();
  const { currentData, isError, isFetchNextPageError, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useGetNotificationPagesInfiniteQuery({ unreadOnly: tab === "unread" });
  const sentinel = useLoadMore({ hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage });

  const items = useMemo(() => distinct(currentData?.pages ?? []), [currentData]);
  const today = items.filter((item) => isToday(item.occurredAt));
  const earlier = items.filter((item) => !isToday(item.occurredAt));

  const readAgain = useCallback(() => void dispatch(notificationsApi.util.invalidateTags([notificationListTag])), [dispatch]);
  const atTop = () => (list.current?.scrollTop ?? 0) <= TOP_SLACK_PX;

  useNotificationSignals((kind) => {
    if (kind === "Removed" || kind === "Read" || atTop()) readAgain();
    else setHasNew(true);
  });

  const changeTab = (next: Tab) => {
    setTab(next);
    setHasNew(false);
    list.current?.scrollTo({ top: 0 });
  };
  const showNew = () => {
    list.current?.scrollTo({ top: 0 });
    setHasNew(false);
    readAgain();
  };
  // Coming back to the top by hand also brings in what the button offered.
  const onScroll = () => {
    if (hasNew && atTop()) showNew();
  };

  const unread = formatUnread(count);
  const isFirstLoad = !currentData && !isError;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{t("notifications.title")}</h2>
        <Button size="sm" variant="ghost" isDisabled={count === 0} onPress={() => void markAllRead()}>
          {t("notifications.markAllRead")}
        </Button>
        <Button isIconOnly size="sm" variant="ghost" aria-label={t("common.close")} className="sm:hidden" onPress={onClose}>
          <Xmark aria-hidden className="size-4" />
        </Button>
      </div>

      <Tabs className="w-fit px-4 pb-3" selectedKey={tab} onSelectionChange={(key) => changeTab(key as Tab)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label={t("notifications.title")}>
            <Tabs.Tab id="all" className="w-auto shrink-0 px-4">
              {t("notifications.all")}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="unread" className="w-auto shrink-0 px-4">
              <Tabs.Separator />
              {unread ? `${t("notifications.unread")} (${unread})` : t("notifications.unread")}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      <div className="relative flex min-h-0 flex-1 flex-col border-t border-separator">
        {hasNew && (
          <Button size="sm" variant="primary" className="absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-full shadow-lg" onPress={showNew}>
            {t("notifications.new")}
          </Button>
        )}
        <div ref={list} data-slot="notification-list" onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
          {isFirstLoad ? (
            <NotificationSkeleton />
          ) : isError && items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm text-muted">
              {t("notifications.loadFailed")}
              <Button size="sm" variant="secondary" onPress={() => void refetch()}>
                {t("notifications.retry")}
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">{t(tab === "unread" ? "notifications.emptyUnread" : "notifications.empty")}</p>
          ) : (
            <>
              <Group title={t("notifications.today")} items={today} />
              <Group title={t("notifications.earlier")} items={earlier} />
              <div ref={sentinel} aria-hidden />
              {isFetchingNextPage && <NotificationSkeleton count={2} />}
              {isFetchNextPageError && !isFetchingNextPage && (
                <div className="flex items-center justify-center gap-3 px-4 py-3 text-sm text-muted">
                  {t("notifications.loadFailed")}
                  <Button size="sm" variant="secondary" onPress={() => void fetchNextPage()}>
                    {t("notifications.retry")}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ title, items }: { title: string; items: NotificationDto[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title}>
      <h3 className="px-4 pt-3 pb-1 text-xs font-semibold text-muted">{title}</h3>
      <ul>
        {items.map((item) => (
          <NotificationRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
