"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Tabs, toast } from "@heroui/react";
import { Xmark } from "@gravity-ui/icons";
import { useAppDispatch } from "@/core/hooks";
import { useLoadMore } from "@/features/posts/hooks/useLoadMore";
import { toApiProblem } from "@/shared/api/problem";
import {
  useGetUnreadNotificationCountQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  type NotificationDto,
} from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { notificationListTag, notificationsApi, useGetNotificationPagesInfiniteQuery } from "../api";
import { useNotificationSignals } from "../hooks/useNotificationSignals";
import { notificationHref } from "../lib/notificationText";
import { NotificationRow } from "./NotificationRow";
import { NotificationSkeleton } from "./NotificationSkeleton";

type Tab = "all" | "unread";

/** Closer than this to the top of the list is the top: a new row there shows at once instead of offering a button. */
const TOP_SLACK_PX = 8;
/** A first load quicker than this shows no skeleton: it would only flash before the rows, or the empty line. */
const SKELETON_DELAY_MS = 300;
/** The skeleton rows at the end, once scrolled to, stay at least this long before the next rows take their place. */
const MORE_SKELETON_MIN_MS = 400;

/** True once `isWaiting` has stayed true for `delayMs`; each new wait starts the delay again. */
function useShownAfter(isWaiting: boolean, delayMs: number) {
  const [shown, setShown] = useState(false);
  const [wasWaiting, setWasWaiting] = useState(isWaiting);
  if (isWaiting !== wasWaiting) {
    setWasWaiting(isWaiting);
    setShown(false);
  }
  useEffect(() => {
    if (!isWaiting) return;
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(timer);
  }, [isWaiting, delayMs]);
  return isWaiting && shown;
}

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
 * first in two groups, 20 more rows read once the skeleton rows at the end are scrolled to. It lives only while open, so each opening starts from
 * the first page. Signals from the bell keep it current: a row going away or being read is read again at once; a new or
 * changed one too while the list is at its top, else a button offers to go there and read. Pressing a row marks it read,
 * closes the panel and goes to the comment, post or meeting it is about.
 */
export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<Tab>("all");
  const [hasNew, setHasNew] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  const { currentData: knownCount } = useGetUnreadNotificationCountQuery();
  const count = knownCount ?? 0;
  const [markAllRead] = useMarkAllNotificationsReadMutation();
  const [markRead] = useMarkNotificationReadMutation();
  const router = useRouter();
  // The count is kept current by the hub, so with none unread the tab is empty without asking; one arriving starts the read.
  const nothingUnread = tab === "unread" && knownCount === 0;
  const { currentData, isError, isFetchNextPageError, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useGetNotificationPagesInfiniteQuery({ unreadOnly: tab === "unread" }, { skip: nothingUnread });

  // The next page is asked for only once the skeleton rows at the end are in view, and its rows wait until those have
  // been seen for a moment: the pages read so far are all that is listed meanwhile, however quickly it comes.
  const [heldPages, setHeldPages] = useState<number | null>(null);
  const pageCount = currentData?.pages.length ?? 0;
  const loadMore = useCallback(async () => {
    setHeldPages(pageCount);
    await Promise.allSettled([fetchNextPage(), new Promise((resolve) => setTimeout(resolve, MORE_SKELETON_MIN_MS))]);
    setHeldPages(null);
  }, [fetchNextPage, pageCount]);
  const isHolding = heldPages !== null;
  const sentinel = useLoadMore({
    hasNextPage,
    isFetchingNextPage: isFetchingNextPage || isHolding,
    isFetchNextPageError,
    fetchNextPage: loadMore,
    rootMargin: "0px",
  });

  const items = useMemo(() => distinct((currentData?.pages ?? []).slice(0, heldPages ?? undefined)), [currentData, heldPages]);
  // The count may still be loading, or have failed, while the rows show unread ones.
  const hasUnread = count > 0 || items.some((item) => !item.isRead);
  const today = items.filter((item) => isToday(item.occurredAt));
  const earlier = items.filter((item) => !isToday(item.occurredAt));

  const readAgain = useCallback(() => void dispatch(notificationsApi.util.invalidateTags([notificationListTag])), [dispatch]);
  const atTop = () => (list.current?.scrollTop ?? 0) <= TOP_SLACK_PX;

  useNotificationSignals((kind) => {
    if (kind === "Removed" || kind === "Read" || atTop()) readAgain();
    else setHasNew(true);
  });

  async function readAll() {
    try {
      await markAllRead().unwrap();
    } catch (failure) {
      toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
    }
  }

  // Reading it is not waited for, nor does its failing stop the way: the row stays unread and can be pressed again.
  // Kept the same from one render to the next, so the memoized rows already shown are not drawn again.
  const open = useCallback(
    (item: NotificationDto) => {
      if (!item.isRead) void markRead({ id: item.id });
      onClose();
      router.push(notificationHref(item));
    },
    [markRead, onClose, router],
  );

  const changeTab = (next: Tab) => {
    setTab(next);
    setHasNew(false);
    setHeldPages(null);
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

  const isFirstLoad = !currentData && !isError && !nothingUnread;
  const showSkeleton = useShownAfter(isFirstLoad, SKELETON_DELAY_MS);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{t("notifications.title")}</h2>
        <Button size="sm" variant="ghost" isDisabled={!hasUnread} onPress={() => void readAll()}>
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
              {count > 0 ? `${t("notifications.unread")} (${count})` : t("notifications.unread")}
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
            showSkeleton && <NotificationSkeleton />
          ) : isError && items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-10 text-center text-sm text-muted">
              {t("notifications.loadFailed")}
              <Button size="sm" variant="secondary" onPress={() => void refetch()}>
                {t("notifications.retry")}
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p className="flex h-full items-center justify-center px-4 py-10 text-center text-sm text-muted">{t(tab === "unread" ? "notifications.emptyUnread" : "notifications.empty")}</p>
          ) : (
            <>
              <Group title={t("notifications.today")} items={today} onOpen={open} />
              <Group title={t("notifications.earlier")} items={earlier} onOpen={open} />
              {/* Kept at the end while there is more, not only while it loads: scrolling to it is what asks for the rest. */}
              {(hasNextPage || isHolding) && !isFetchNextPageError && (
                <div ref={sentinel}>
                  <NotificationSkeleton count={2} />
                </div>
              )}
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

function Group({ title, items, onOpen }: { title: string; items: NotificationDto[]; onOpen: (item: NotificationDto) => void }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title}>
      <h3 className="px-4 pt-3 pb-1 text-xs font-semibold text-muted">{title}</h3>
      <ul>
        {items.map((item) => (
          <NotificationRow key={item.id} item={item} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}
