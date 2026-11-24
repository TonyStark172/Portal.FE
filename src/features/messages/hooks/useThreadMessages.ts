"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "react-redux";
import { useAppDispatch } from "@/core/hooks";
import type { RootState } from "@/core/store";
import type { ChatMessageDto, ChatMessagePage } from "@/shared/api/generated/portalApi";
import { useHubSignal } from "@/shared/realtime/hub";
import { messagesApi, useGetChatMessagePagesInfiniteQuery, type MessagesArg } from "../api";
import { distinctMessages, hasMessage, mergeLatest, putMessage, removeMessage, resetToLatest, type MessagePages } from "../lib/messagePages";

/**
 * The messages a thread shows and everything that keeps them right.
 *
 * It shows either the latest messages (and older ones as they are read going back), or, after a jump to a message that
 * was not loaded, a window around that message that can be read on in both directions.
 *
 * Nothing loaded is read again as a whole. When the hub says a message is new or changed, only the latest page is read
 * and merged in (one request, however far back the reader has gone), and a changed message further back is read by
 * itself. What the reader does themselves is put in place from the server's answer.
 */
export function useThreadMessages(conversationId: number, latestMessageId: number | null | undefined) {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const [around, setAround] = useState<number | null>(null);
  const arg = useMemo<MessagesArg>(() => ({ conversationId, around }), [conversationId, around]);
  const query = useGetChatMessagePagesInfiniteQuery(arg);
  const { currentData, hasPreviousPage } = query;
  const messages = useMemo(() => distinctMessages(currentData?.pages), [currentData]);
  // The pages reach the latest message: new ones belong at their front.
  const atLatest = currentData !== undefined && !hasPreviousPage;

  // What the callbacks below read at the time they run, not at the time they were made.
  const state = useRef({ arg, atLatest, messages });
  useEffect(() => {
    state.current = { arg, atLatest, messages };
  });

  const update = useCallback(
    (target: MessagesArg, recipe: (data: MessagePages) => void) =>
      void dispatch(messagesApi.util.updateQueryData("getChatMessagePages", target, recipe)),
    [dispatch],
  );

  /** A message the server returned (sent, edited, reacted to, voted in…) takes its place. */
  const put = useCallback((message: ChatMessageDto) => update(state.current.arg, (data) => putMessage(data, message)), [update]);
  const remove = useCallback((id: number) => update(state.current.arg, (data) => removeMessage(data, id)), [update]);

  const readLatest = useCallback(
    (): Promise<ChatMessagePage> =>
      dispatch(messagesApi.endpoints.readLatestChatMessages.initiate(conversationId, { forceRefetch: true, subscribe: false })).unwrap(),
    [dispatch, conversationId],
  );

  /** Shows the latest messages again, as they are now (after a window further back, or after writing from one). */
  const goToLatest = useCallback(async () => {
    const live: MessagesArg = { conversationId, around: null };
    setAround(null);
    // Nothing kept of the latest view (it was left long enough ago): it reads itself afresh.
    // (The store's own type does not carry the tags the generated API adds, which the selector's type asks for.)
    if (messagesApi.endpoints.getChatMessagePages.select(live)(store.getState() as never).data === undefined) return;
    try {
      const latest = await readLatest();
      // What the latest view had loaded before may be out of date by now: it starts over from the latest page.
      update(live, (data) => resetToLatest(data, latest));
    } catch {
      // The view reads it itself, and says so if it cannot.
    }
  }, [conversationId, readLatest, update, store]);

  /** Reads one message again, wherever it is among the loaded ones; gone for the reader, it is taken out. */
  const refreshMessage = useCallback(
    async (id: number) => {
      try {
        put(await dispatch(messagesApi.endpoints.readChatMessage.initiate(id, { forceRefetch: true, subscribe: false })).unwrap());
      } catch (failure) {
        if ((failure as { status?: number }).status === 404) remove(id);
      }
    },
    [dispatch, put, remove],
  );

  // One read of the latest page at a time; a request that comes meanwhile runs once more after it.
  const syncing = useRef<{ again: boolean } | null>(null);
  /** Brings the view up to date with the latest page. Does nothing in a window further back, which new messages are not part of. */
  const syncLatest = useCallback(async (): Promise<ChatMessagePage | null> => {
    if (!state.current.atLatest) return null;
    if (syncing.current) {
      syncing.current.again = true;
      return null;
    }
    syncing.current = { again: false };
    let latest: ChatMessagePage | null = null;
    try {
      do {
        syncing.current.again = false;
        latest = await readLatest();
        const { arg: target, atLatest: still } = state.current;
        if (!still) break;
        const merge: { outcome: "merged" | "gap" } = { outcome: "merged" };
        const page = latest;
        update(target, (data) => {
          merge.outcome = mergeLatest(data, page);
        });
        // More came in than a page holds: the latest view starts over; a window further back gives way to it.
        if (merge.outcome === "gap") {
          if (target.around === null) update(target, (data) => resetToLatest(data, page));
          else void goToLatest();
        }
      } while (syncing.current.again);
    } catch {
      // A later signal, or the reader, tries again.
    } finally {
      syncing.current = null;
    }
    return latest;
  }, [readLatest, update, goToLatest]);

  /** After something that changed a message and may have added one (a pin adds a line): both are read. */
  const refreshAfterChange = useCallback(
    async (messageId: number) => {
      const latest = await syncLatest();
      const covered = latest?.items.some((item) => item.id === messageId) ?? false;
      if (!covered && state.current.messages.some((message) => message.id === messageId)) await refreshMessage(messageId);
    },
    [syncLatest, refreshMessage],
  );

  useHubSignal((signal) => {
    // The connection came back, or the page did: signals may have been missed.
    if (signal.kind === "Resync" || (signal.kind === "Messages" && signal.conversationId == null)) return void syncLatest();
    if (signal.kind !== "Messages" || signal.conversationId !== conversationId) return;
    // Without a message, nothing in the messages changed (someone read them, a setting).
    if (signal.messageId != null) void refreshAfterChange(signal.messageId);
  });

  // Without the hub (or a signal lost): the conversation's details, read again every minute, say what its latest message is.
  const newestId = messages[0]?.id ?? null;
  useEffect(() => {
    if (!atLatest || latestMessageId == null || (newestId !== null && latestMessageId <= newestId)) return;
    // A moment later: the signal for the same message usually gets there first, and then there is nothing left to read.
    const timer = setTimeout(() => void syncLatest(), 300);
    return () => clearTimeout(timer);
  }, [atLatest, latestMessageId, newestId, syncLatest]);

  return {
    messages,
    /** The message a window is around, or null when the view is of the latest messages. */
    around,
    atLatest,
    isLoading: currentData === undefined && !query.isError,
    isError: query.isError && currentData === undefined,
    retry: query.refetch,
    older: {
      hasNextPage: query.hasNextPage,
      isFetchingNextPage: query.isFetchingNextPage,
      isFetchNextPageError: query.isFetchNextPageError,
      fetchNextPage: query.fetchNextPage,
    },
    newer: {
      hasNextPage: query.hasPreviousPage,
      isFetchingNextPage: query.isFetchingPreviousPage,
      isFetchNextPageError: query.isFetchPreviousPageError,
      fetchNextPage: query.fetchPreviousPage,
    },
    /** Shows the window around a message that is not among the loaded ones. */
    showAround: setAround,
    goToLatest,
    put,
    remove,
    refreshMessage,
    refreshAfterChange,
    isLoaded: (id: number) => (currentData ? hasMessage(currentData, id) : false),
  };
}
