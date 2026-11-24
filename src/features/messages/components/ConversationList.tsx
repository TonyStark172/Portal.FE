"use client";

import { useMemo, useState } from "react";
import { Button, SearchField, Skeleton, Tooltip } from "@heroui/react";
import { BellSlash, PencilToSquare, Persons } from "@gravity-ui/icons";
import { useLoadMore } from "@/features/posts/hooks/useLoadMore";
import type { ConversationDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { formatUnreadConversations, useGetConversationPagesInfiniteQuery } from "../api";
import { listTime } from "../lib/messageTime";
import { conversationName, previewText } from "../lib/messageText";
import { ConversationAvatar } from "./ConversationAvatar";
import { useDebounced } from "./PeoplePicker";

/** The conversations of all the pages read so far, each once (one that moved to the top can still be on a later page). */
function distinct(pages: { items: ConversationDto[] }[] | undefined): ConversationDto[] {
  const seen = new Set<number>();
  return (pages ?? []).flatMap((page) => page.items).filter((item) => !seen.has(item.id) && seen.add(item.id));
}

/**
 * The current user's conversations, the latest message first, with what was said last and how many messages are
 * unread; searched by name. More are read when the end of the list is scrolled to; it is read again each minute too,
 * for who is active.
 */
export function ConversationList({ selectedId, onSelect, onNew, myId }: {
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNew: (mode: "direct" | "group") => void;
  myId: number | undefined;
}) {
  const { t, locale } = useLocale();
  const [search, setSearch] = useState("");
  const term = useDebounced(search.trim(), 300);
  const { currentData, isLoading, isError, refetch, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } =
    useGetConversationPagesInfiniteQuery({ search: term }, { pollingInterval: 60_000 });
  const conversations = useMemo(() => distinct(currentData?.pages), [currentData]);
  const sentinel = useLoadMore({ hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 px-3 pt-2.5 pb-2">
        <h2 className="flex-1 text-lg font-semibold">{t("messages.title")}</h2>
        <Tooltip delay={400}>
          <Button isIconOnly size="sm" variant="ghost" aria-label={t("messages.newGroup")} onPress={() => onNew("group")}>
            <Persons className="size-4" />
          </Button>
          <Tooltip.Content>{t("messages.newGroup")}</Tooltip.Content>
        </Tooltip>
        <Tooltip delay={400}>
          <Button isIconOnly size="sm" variant="secondary" aria-label={t("messages.new")} onPress={() => onNew("direct")}>
            <PencilToSquare className="size-4" />
          </Button>
          <Tooltip.Content>{t("messages.new")}</Tooltip.Content>
        </Tooltip>
      </div>
      <div className="px-3 pb-2">
        <SearchField aria-label={t("messages.searchConversations")} value={search} onChange={setSearch} variant="secondary" fullWidth>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={t("messages.searchConversations")} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar px-1.5 pb-1.5" aria-busy={isLoading}>
        {isLoading && (
          <div className="flex flex-col gap-1 p-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-1.5">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-2/3 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && !currentData && (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted">
            {t("messages.loadError")}
            <Button size="sm" variant="secondary" onPress={() => void refetch()}>{t("common.retry")}</Button>
          </div>
        )}

        {!isLoading && !isError && conversations.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">{t(term ? "messages.noResults" : "messages.noConversations")}</p>
        )}

        <ul className="flex flex-col gap-0.5">
          {conversations.map((conversation) => {
            const unread = formatUnreadConversations(conversation.unreadCount);
            const last = conversation.lastMessage;
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  aria-current={conversation.id === selectedId ? "true" : undefined}
                  onClick={() => onSelect(conversation.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus aria-[current=true]:bg-(--nav-selected)"
                >
                  <ConversationAvatar conversation={conversation} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-baseline gap-2">
                      <span className={`min-w-0 flex-1 truncate text-sm ${unread ? "font-semibold" : "font-medium"}`}>{conversationName(conversation, t)}</span>
                      {last && <span className="shrink-0 text-xs text-muted">{listTime(last.sentAt, locale)}</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={`min-w-0 flex-1 truncate text-xs ${unread ? "font-semibold text-foreground" : "text-muted"}`}>
                        {last ? previewText(last, conversation, myId, t) : ""}
                      </span>
                      {conversation.isMuted && <BellSlash className="size-3.5 shrink-0 text-muted" aria-label={t("messages.muted")} />}
                      {unread && (
                        <span className={`shrink-0 rounded-full px-1.5 text-[0.6875rem] font-semibold leading-4 ${conversation.isMuted ? "bg-default text-muted" : "bg-accent text-accent-foreground"}`}>
                          <span className="sr-only">{t("messages.unread")}: </span>
                          {unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {hasNextPage && <div ref={sentinel} className="h-8" />}
      </div>
    </div>
  );
}
