"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject, type UIEvent } from "react";
import { Button, Separator, Skeleton, Tooltip, toast } from "@heroui/react";
import { ArrowDown, ArrowLeft, CircleInfo, Magnifier, Pin } from "@gravity-ui/icons";
import {
  useAddChatPollOptionMutation,
  useCloseChatPollMutation,
  useGetConversationQuery,
  useGetPinnedChatMessagesQuery,
  useHideChatMessageMutation,
  useMarkConversationReadMutation,
  usePinChatMessageMutation,
  useReactToChatMessageMutation,
  useRecallChatMessageMutation,
  useUnpinChatMessageMutation,
  useVoteChatPollMutation,
  type ChatMessageDto,
  type ConversationMemberDto,
} from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { useThreadMessages } from "../hooks/useThreadMessages";
import { useTypingUsers } from "../hooks/useTyping";
import { dayKey, dayLabel, GROUP_WINDOW_MS } from "../lib/messageTime";
import { attachmentsLabel, conversationName, givenName, isActiveNow, lastActiveLabel } from "../lib/messageText";
import { ConfirmAction } from "./ConfirmAction";
import { ConversationAvatar } from "./ConversationAvatar";
import { InfoPanel, PinnedPanel, SearchPanel, type SidePanel } from "./ConversationSidePanels";
import { ForwardDialog } from "./ForwardDialog";
import { MessageComposer } from "./MessageComposer";
import { EDIT_WINDOW_MS, MessageItem, type MessageAction } from "./MessageItem";
import { PollVotesDialog } from "./PollCard";
import { ReactionsDialog } from "./ReactionsDialog";
import { SharedContentPanel } from "./SharedContentPanel";

/** Nobody's reading stops at most messages: one array for all of them, so those rows are not drawn again each time. */
const SEEN_BY_NOBODY: ConversationMemberDto[] = [];

/**
 * The clock a message's row needs: the real one only while it can change what the row shows (its writer may still edit
 * it, or it is a poll with a deadline). Every other row gets a clock that never ticks, so the thousands of rows of a
 * long conversation are not drawn again twice a minute.
 */
function rowClock(message: ChatMessageDto, now: number): number {
  if (message.poll?.endsAt) return now;
  return now - new Date(message.sentAt).getTime() < EDIT_WINDOW_MS ? now : Number.POSITIVE_INFINITY;
}

/** How far from the latest message (px) the reader has to be for the way back to it to be offered. */
const AWAY_FROM_LATEST = 600;

/** Whether the browser keeps what is in view in place by itself when content is added around it (all but Safari). */
const SCROLL_ANCHORING = typeof CSS !== "undefined" && CSS.supports("overflow-anchor", "auto");

type Paging = { hasNextPage: boolean; isFetchingNextPage: boolean; isFetchNextPageError: boolean; fetchNextPage: () => unknown };

/**
 * Reads the next page when the element this returns a ref for comes within `margin` of the visible part of `root`:
 * before the reader reaches the end of what is loaded, so they seldom see it load.
 */
function useReadAhead(root: RefObject<HTMLElement | null>, paging: Paging, margin: string) {
  const [edge, setEdge] = useState<HTMLElement | null>(null);
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = paging;
  useEffect(() => {
    if (!edge || !hasNextPage || isFetchingNextPage || isFetchNextPageError) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void fetchNextPage();
      },
      { root: root.current, rootMargin: margin },
    );
    observer.observe(edge);
    return () => observer.disconnect();
  }, [edge, root, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, margin]);
  return setEdge;
}

const SKELETON_WIDTHS = ["w-44", "w-64", "w-32", "w-56", "w-40", "w-72", "w-36", "w-52"];

/** Bubbles in the shape of a conversation, where messages are on their way. */
function MessageSkeletons({ count, label }: { count: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2 py-1">
      {Array.from({ length: count }, (_, i) => {
        const mine = i % 3 === 2;
        return (
          <div key={i} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
            {!mine && <Skeleton className="size-8 shrink-0 rounded-full" />}
            <Skeleton className={`h-9 max-w-[70%] rounded-2xl ${SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]}`} />
          </div>
        );
      })}
    </div>
  );
}

/** Whether the page is in front: a conversation is only marked read while someone can see it. */
function useDocumentVisible() {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/** Two messages close enough in time from the same person are drawn as one run (one avatar, one name). */
const sameRun = (earlier: ChatMessageDto, later: ChatMessageDto) =>
  earlier.kind === "Text" && later.kind === "Text" && earlier.senderId === later.senderId
  && dayKey(earlier.sentAt) === dayKey(later.sentAt)
  && new Date(later.sentAt).getTime() - new Date(earlier.sentAt).getTime() < GROUP_WINDOW_MS;

/** Three dots that bounce, with who is typing beside them. */
function TypingBubble({ typers }: { typers: ConversationMemberDto[] }) {
  const { t } = useLocale();
  if (typers.length === 0) return null;
  const first = typers[0];
  return (
    <div className="mt-2 flex items-end gap-2" aria-live="polite">
      <UserAvatar fullName={first.fullName} avatarUrl={first.avatarUrl} size="sm" className="size-8" />
      <span className="flex items-center gap-1 rounded-2xl bg-default px-3 py-2.5" aria-label={t("messages.typing").replace("{name}", typers.map((m) => givenName(m.fullName)).join(", "))}>
        {[0, 1, 2].map((dot) => (
          <span key={dot} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${dot * 150}ms` }} />
        ))}
      </span>
    </div>
  );
}

/**
 * One conversation: its messages (newest at the bottom, older ones read ahead as the reader scrolls up), the latest
 * pinned one above them, the box to write in, and the panels for its details, pinned messages and search. The list
 * scrolls from the bottom (column-reverse), so it stays on the newest message as they come and older pages added at the
 * top do not move what is in view. A jump to a message that is not loaded (a search result, an old pin) shows the
 * messages around it instead, however far back, with a way back to the latest. While it is on screen and the page is in
 * front, the conversation is marked read.
 */
export function ConversationThread({ conversationId, myId, onBack, onLeft }: {
  conversationId: number;
  myId: number | undefined;
  onBack: () => void;
  /** The current user left it or deleted it on their side: the page shows the list again. */
  onLeft: () => void;
}) {
  const { t, locale } = useLocale();
  const visible = useDocumentVisible();
  // Read again each minute too, for the others' "active now".
  const { currentData: conversation, isError: conversationFailed } = useGetConversationQuery({ id: conversationId }, { pollingInterval: 60_000 });
  const thread = useThreadMessages(conversationId, conversation?.lastMessage?.id);
  const { messages, around, atLatest, isLoading, isError, showAround, goToLatest, put: putMessage, remove: removeMessage, refreshMessage, refreshAfterChange } = thread;
  const scroller = useRef<HTMLDivElement>(null);
  // A screen and a half ahead going back, where there is the most to read; less towards the present.
  const olderEdge = useReadAhead(scroller, thread.older, "1200px 0px 0px 0px");
  const newerEdge = useReadAhead(scroller, thread.newer, "0px 0px 200px 0px");
  const { currentData: pinned } = useGetPinnedChatMessagesQuery({ id: conversationId });

  const [markRead] = useMarkConversationReadMutation();
  const [react] = useReactToChatMessageMutation();
  const [pin] = usePinChatMessageMutation();
  const [unpin] = useUnpinChatMessageMutation();
  const [recall, { isLoading: isRecalling }] = useRecallChatMessageMutation();
  const [hide] = useHideChatMessageMutation();
  const [vote] = useVoteChatPollMutation();
  const [addPollOption] = useAddChatPollOptionMutation();
  const [closePoll, { isLoading: isClosingPoll }] = useCloseChatPollMutation();

  const [replyTo, setReplyTo] = useState<ChatMessageDto | null>(null);
  const [editing, setEditing] = useState<ChatMessageDto | null>(null);
  const [forwarding, setForwarding] = useState<ChatMessageDto | null>(null);
  const [recalling, setRecalling] = useState<ChatMessageDto | null>(null);
  // An id, so the dialog follows the message as reactions come and go.
  const [reactionsOf, setReactionsOf] = useState<number | null>(null);
  // Ids too, so the votes follow the poll as people vote.
  const [pollVotesOf, setPollVotesOf] = useState<number | null>(null);
  const [closingPoll, setClosingPoll] = useState<ChatMessageDto | null>(null);
  const [panel, setPanel] = useState<SidePanel | null>(null);
  const pendingJump = useRef<number | null>(null);
  // Far enough up for the way back to the latest message to be offered.
  const [away, setAway] = useState(false);
  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const far = Math.abs(event.currentTarget.scrollTop) > AWAY_FROM_LATEST;
    setAway((current) => (current === far ? current : far));
  }, []);
  // The clock the "edit" action (15 minutes after sending) and the polls' countdowns go by, moved on twice a minute; a
  // vote that comes in just after a deadline is refused by the server anyway.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const members = useMemo(() => conversation?.members ?? [], [conversation]);
  const canWrite = members.some((member) => member.isActive);
  const unread = conversation?.unreadCount ?? 0;

  // "New messages" goes above the first message after the one read when the conversation is first seen, or when the
  // page comes back to the front, with something unread: taken before it is marked read, it stays until the reader
  // writes (as on Messenger), so marking it read does not take it away.
  const [newSince, setNewSince] = useState<number | null>(null);
  const [seenAs, setSeenAs] = useState({ loaded: false, visible });
  const loaded = conversation !== undefined;
  if (loaded !== seenAs.loaded || visible !== seenAs.visible) {
    setSeenAs({ loaded, visible });
    if (loaded && visible && unread > 0) setNewSince(conversation.lastReadMessageId);
  }
  // The divider is scrolled to once, when it first appears out of sight.
  const scrolledToNew = useRef(false);
  const newDivider = useCallback((node: HTMLDivElement | null) => {
    if (!node || scrolledToNew.current) return;
    scrolledToNew.current = true;
    node.scrollIntoView({ block: "nearest" });
  }, []);

  // Read again (by a signal or the mutation) the count drops to 0, so it is marked once per new message.
  useEffect(() => {
    if (unread > 0 && visible) void markRead({ id: conversationId });
  }, [unread, visible, conversationId, markRead]);

  const newest = messages[0];
  const typingIds = useTypingUsers(conversationId, newest ? `${newest.id}:${newest.senderId}` : "");
  const typers = members.filter((member) => typingIds.includes(member.userId));

  // Each member's avatar goes under the latest message they have read.
  const seenBy = useMemo(() => {
    const map = new Map<number, ConversationMemberDto[]>();
    for (const member of members) {
      const last = messages.find((message) => message.id <= member.lastReadMessageId && message.kind !== "System");
      if (!last || last.senderId === member.userId) continue;
      map.set(last.id, [...(map.get(last.id) ?? []), member]);
    }
    return map;
  }, [members, messages]);

  /** Brings a loaded message into view and lights it up for a moment; false when it is not among the loaded ones. */
  const showMessage = useCallback((messageId: number, behavior: ScrollBehavior) => {
    const element = document.getElementById(`message-${messageId}`);
    if (!element) return false;
    element.scrollIntoView({ block: "center", behavior });
    element.classList.add("message-highlight");
    setTimeout(() => element.classList.remove("message-highlight"), 2000);
    return true;
  }, []);

  // A jump to a message: scrolled to when it is loaded; otherwise the messages around it are read, in one request
  // however far back it is, and it is shown once they are there.
  const jumpTo = useCallback(
    (messageId: number) => {
      // On a phone the panel covers the conversation: it gives way.
      if (!window.matchMedia("(min-width: 768px)").matches) setPanel(null);
      if (showMessage(messageId, "smooth")) return;
      pendingJump.current = messageId;
      showAround(messageId);
    },
    [showMessage, showAround],
  );
  // Before the browser paints the window around it: the reader lands on the message, not at the window's end (which
  // would also read on towards the present at once).
  useLayoutEffect(() => {
    const target = pendingJump.current;
    if (target === null || around !== target || isLoading) return;
    pendingJump.current = null;
    if (!isError && !showMessage(target, "auto")) toast.warning(t("messages.messageGone"));
  }, [around, isLoading, isError, messages, showMessage, t]);

  // Back at the latest messages, the view is at its bottom again.
  useLayoutEffect(() => {
    if (around === null) scroller.current?.scrollTo({ top: 0 });
  }, [around]);

  // Where the browser does not keep what is in view in place itself: when newer messages come in under a reader who has
  // scrolled up, the list is moved by their height, so the reader stays where they were.
  const laidOut = useRef<{ newest: number | null; height: number }>({ newest: null, height: 0 });
  useLayoutEffect(() => {
    const list = scroller.current;
    if (!list) return;
    const newest = messages[0]?.id ?? null;
    const previous = laidOut.current;
    if (!SCROLL_ANCHORING && previous.newest !== null && newest !== null && newest > previous.newest && list.scrollTop < -1) {
      list.scrollTop -= list.scrollHeight - previous.height;
    }
    laidOut.current = { newest, height: list.scrollHeight };
  }, [messages]);

  const toLatest = useCallback(() => {
    if (around !== null) void goToLatest();
    scroller.current?.scrollTo({ top: 0, behavior: around === null ? "smooth" : "auto" });
  }, [around, goToLatest]);

  const fail = useCallback((failure: unknown) => toast.danger(toApiProblem(failure).detail ?? t("common.genericError")), [t]);

  const onAction = useCallback(
    (action: MessageAction, message: ChatMessageDto) => {
      switch (action) {
        case "reply":
          setEditing(null);
          setReplyTo(message);
          break;
        case "edit":
          setReplyTo(null);
          setEditing(message);
          break;
        case "forward":
          setForwarding(message);
          break;
        case "copy":
          void navigator.clipboard.writeText(message.content).then(() => toast.success(t("messages.copied")));
          break;
        case "pin":
          // The message is marked pinned and a line saying so is added: both are read.
          pin({ messageId: message.id }).unwrap()
            .then(() => {
              toast.success(t("messages.pinnedDone"));
              void refreshAfterChange(message.id);
            })
            .catch(fail);
          break;
        case "unpin":
          unpin({ messageId: message.id }).unwrap().then(() => refreshAfterChange(message.id)).catch(fail);
          break;
        case "recall":
          setRecalling(message);
          break;
        case "hide":
          hide({ messageId: message.id }).unwrap().then(() => removeMessage(message.id)).catch(fail);
          break;
        case "closePoll":
          setClosingPoll(message);
          break;
      }
    },
    [pin, unpin, hide, fail, t, refreshAfterChange, removeMessage],
  );

  const onReact = useCallback(
    (message: ChatMessageDto, emoji: string | null) =>
      react({ messageId: message.id, reactToChatMessageCommand: { emoji } }).unwrap().then(putMessage).catch(fail),
    [react, putMessage, fail],
  );
  const onShowReactions = useCallback((message: ChatMessageDto) => setReactionsOf(message.id), []);
  const onVote = useCallback(
    (message: ChatMessageDto, optionIds: number[]) =>
      vote({ messageId: message.id, voteChatPollCommand: { optionIds } }).unwrap().then(putMessage).catch(fail),
    [vote, putMessage, fail],
  );
  // A refusal is left to the poll, which keeps what was being written.
  const onAddPollOption = useCallback(
    (message: ChatMessageDto, text: string) =>
      addPollOption({ messageId: message.id, addChatPollOptionCommand: { text } }).unwrap().then(putMessage),
    [addPollOption, putMessage],
  );
  const onShowPollVotes = useCallback((message: ChatMessageDto) => setPollVotesOf(message.id), []);
  const reactionsMessage = reactionsOf === null ? null : messages.find((message) => message.id === reactionsOf) ?? null;
  // Once nobody reacts any more (the last one removed, the message recalled) the list is closed for good, so a new
  // reaction later does not open it again.
  if (reactionsOf !== null && !reactionsMessage?.reactions.length) setReactionsOf(null);

  if (conversationFailed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted">
        {t("messages.notFound")}
        <Button size="sm" variant="secondary" onPress={onBack}>{t("messages.back")}</Button>
      </div>
    );
  }

  const partner = conversation && !conversation.isGroup ? conversation.members[0] : undefined;
  const subtitle = !conversation
    ? ""
    : typers.length > 0
      ? t("messages.typing").replace("{name}", typers.map((m) => givenName(m.fullName)).join(", "))
      : conversation.isGroup
        ? members.some((m) => m.isActive && isActiveNow(m.lastActiveAt))
          ? t("messages.someoneActive")
          : t("messages.memberCount").replace("{count}", String(members.length + 1))
        : partner && !partner.isActive
          ? t("messages.deactivated")
          : (lastActiveLabel(partner?.lastActiveAt, t) ?? "");
  const latestPinned = pinned?.[0];

  return (
    <div className="relative flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-separator px-3 py-2">
          <span className="md:hidden">
            <Button isIconOnly size="sm" variant="ghost" aria-label={t("messages.back")} onPress={onBack}>
              <ArrowLeft className="size-4" />
            </Button>
          </span>
          {conversation ? (
            <button type="button" onClick={() => setPanel(panel === "info" ? null : "info")} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <ConversationAvatar conversation={conversation} size="sm" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold">{conversationName(conversation, t)}</span>
                {subtitle && <span className={`truncate text-xs ${typers.length > 0 ? "text-accent" : "text-muted"}`}>{subtitle}</span>}
              </span>
            </button>
          ) : (
            <Skeleton className="h-8 w-48 rounded-lg" />
          )}
          <span className="ms-auto flex items-center">
            <Tooltip delay={400}>
              <Button isIconOnly size="sm" variant="ghost" aria-label={t("messages.searchTitle")} onPress={() => setPanel(panel === "search" ? null : "search")}>
                <Magnifier className="size-4" />
              </Button>
              <Tooltip.Content>{t("messages.searchTitle")}</Tooltip.Content>
            </Tooltip>
            <Tooltip delay={400}>
              <Button isIconOnly size="sm" variant="ghost" aria-label={t("messages.info")} onPress={() => setPanel(panel === "info" ? null : "info")}>
                <CircleInfo className="size-4" />
              </Button>
              <Tooltip.Content>{t("messages.info")}</Tooltip.Content>
            </Tooltip>
          </span>
        </header>

        {latestPinned && (
          <div className="flex items-center gap-2 border-b border-separator px-3 py-1.5 text-xs">
            <Pin className="size-3.5 shrink-0 text-accent" />
            <button type="button" onClick={() => jumpTo(latestPinned.id)} className="min-w-0 flex-1 truncate text-left hover:underline">
              {latestPinned.content || attachmentsLabel(latestPinned.attachments.map((a) => a.kind), t)}
            </button>
            {(pinned?.length ?? 0) > 1 && (
              <button type="button" onClick={() => setPanel("pinned")} className="shrink-0 text-accent hover:underline">
                {t("messages.pinnedCount").replace("{count}", String(pinned!.length))}
              </button>
            )}
          </div>
        )}

        <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scroller} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overflow-x-hidden scrollbar px-3 pt-10 pb-3">
          {/* In a window further back the list ends (at the bottom) in placeholders; coming near them reads on towards the present. */}
          {thread.newer.hasNextPage && !thread.newer.isFetchNextPageError && (
            <div ref={newerEdge}>
              <MessageSkeletons count={2} label={t("messages.loadingMessages")} />
            </div>
          )}
          {thread.newer.isFetchNextPageError && !thread.newer.isFetchingNextPage && (
            <div className="flex items-center justify-center gap-3 py-2 text-sm text-muted">
              {t("messages.loadError")}
              <Button size="sm" variant="secondary" onPress={() => void thread.newer.fetchNextPage()}>{t("common.retry")}</Button>
            </div>
          )}
          {atLatest && <TypingBubble typers={typers} />}
          {messages.map((message, index) => {
            const older: ChatMessageDto | undefined = messages[index + 1];
            const newer: ChatMessageDto | undefined = messages[index - 1];
            const newDay = !older || dayKey(older.sentAt) !== dayKey(message.sentAt);
            const firstNew = newSince !== null && message.id > newSince && (!older || older.id <= newSince);
            return (
              <Fragment key={message.id}>
                <MessageItem
                  message={message}
                  members={members}
                  isGroup={conversation?.isGroup ?? false}
                  isAdmin={conversation?.isAdmin ?? false}
                  myId={myId}
                  startsGroup={!older || !sameRun(older, message)}
                  endsGroup={!newer || !sameRun(message, newer)}
                  seenBy={seenBy.get(message.id) ?? SEEN_BY_NOBODY}
                  now={rowClock(message, now)}
                  onAction={onAction}
                  onReact={onReact}
                  onShowReactions={onShowReactions}
                  onJumpTo={jumpTo}
                  onVote={onVote}
                  onAddPollOption={onAddPollOption}
                  onShowPollVotes={onShowPollVotes}
                />
                {/* Drawn after the message, so above it in this bottom-up list; under the day's label. */}
                {firstNew && (
                  <div ref={newDivider} className="my-3 flex items-center gap-3 px-1" data-testid="new-messages">
                    <Separator className="flex-1 bg-danger/40" />
                    <span className="shrink-0 text-xs font-medium text-danger">{t("messages.newMessages")}</span>
                    <Separator className="flex-1 bg-danger/40" />
                  </div>
                )}
                {newDay && (
                  <p className="my-3 self-center rounded-full bg-default px-2.5 py-0.5 text-[0.6875rem] text-muted">
                    {dayLabel(message.sentAt, locale, { today: t("messages.today"), yesterday: t("messages.yesterday") })}
                  </p>
                )}
              </Fragment>
            );
          })}
          {/* While older messages remain the list ends (at the top) in placeholders; they are read well before the reader gets there. */}
          {thread.older.hasNextPage && !thread.older.isFetchNextPageError && (
            <div ref={olderEdge}>
              <MessageSkeletons count={3} label={t("messages.loadingMessages")} />
            </div>
          )}
          {thread.older.isFetchNextPageError && !thread.older.isFetchingNextPage && (
            <div className="flex items-center justify-center gap-3 py-2 text-sm text-muted">
              {t("messages.loadError")}
              <Button size="sm" variant="secondary" onPress={() => void thread.older.fetchNextPage()}>{t("common.retry")}</Button>
            </div>
          )}
          {isLoading && <MessageSkeletons count={8} label={t("messages.loadingMessages")} />}
          {isError && (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted">
              {t("messages.loadError")}
              <Button size="sm" variant="secondary" onPress={() => void thread.retry()}>{t("common.retry")}</Button>
            </div>
          )}
          {!isLoading && !isError && messages.length === 0 && conversation && (
            <div className="m-auto flex flex-col items-center gap-2 text-center text-sm text-muted">
              <ConversationAvatar conversation={conversation} size="lg" />
              {t("messages.startHint").replace("{name}", conversationName(conversation, t))}
            </div>
          )}
        </div>
          {(around !== null || away) && (
            <Button size="sm" variant="secondary" onPress={toLatest} className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-md">
              <ArrowDown className="size-4" /> {t("messages.toLatest")}
            </Button>
          )}
        </div>

        <MessageComposer
          key={conversationId}
          conversationId={conversationId}
          members={members}
          myId={myId}
          canWrite={!conversation || canWrite}
          replyTo={replyTo}
          editing={editing}
          onCancelReply={() => setReplyTo(null)}
          onCancelEdit={() => setEditing(null)}
          onSent={(message) => {
            // Written from a window further back: the view returns to the latest messages, where it now is.
            if (around !== null) void goToLatest();
            else putMessage(message);
            // Writing answers what was new.
            setNewSince(null);
            scroller.current?.scrollTo({ top: 0 });
          }}
          focusKey={`${replyTo?.id}:${editing?.id}`}
        />
      </div>

      {conversation && panel === "info" && (
        <InfoPanel conversation={conversation} myId={myId} onOpenPanel={setPanel} onLeft={onLeft} onClose={() => setPanel(null)} />
      )}
      {conversation && panel === "pinned" && <PinnedPanel conversation={conversation} myId={myId} onJumpTo={jumpTo} onClose={() => setPanel(null)} />}
      {conversation && panel === "search" && <SearchPanel conversation={conversation} myId={myId} onJumpTo={jumpTo} onClose={() => setPanel(null)} />}
      {conversation && (panel === "media" || panel === "files" || panel === "links") && (
        <SharedContentPanel
          conversation={conversation}
          myId={myId}
          tab={panel}
          onTab={setPanel}
          onJumpTo={jumpTo}
          onBack={() => setPanel("info")}
          onClose={() => setPanel(null)}
        />
      )}

      <ForwardDialog message={forwarding} myId={myId} onClose={() => setForwarding(null)} />
      <ReactionsDialog
        message={reactionsMessage}
        myId={myId}
        onRemoveMine={(message) => onReact(message, null)}
        onClose={() => setReactionsOf(null)}
      />
      <PollVotesDialog
        message={pollVotesOf === null ? null : messages.find((message) => message.id === pollVotesOf) ?? null}
        members={members}
        myId={myId}
        onClose={() => setPollVotesOf(null)}
      />
      {closingPoll && (
        <ConfirmAction
          title={t("messages.poll.close")}
          message={t("messages.poll.closeConfirm")}
          confirmLabel={t("messages.poll.closeAction")}
          isPending={isClosingPoll}
          onConfirm={() =>
            closePoll({ messageId: closingPoll.id }).unwrap()
              .then(putMessage)
              .catch(fail)
              .finally(() => setClosingPoll(null))
          }
          onClose={() => setClosingPoll(null)}
        />
      )}
      {recalling && (
        <ConfirmAction
          title={t("messages.recallTitle")}
          message={t("messages.recallConfirm")}
          confirmLabel={t("messages.action.recall")}
          isPending={isRecalling}
          onConfirm={() =>
            recall({ messageId: recalling.id }).unwrap()
              .then(() => {
                setRecalling(null);
                void refreshMessage(recalling.id);
              })
              .catch((failure) => {
                fail(failure);
                setRecalling(null);
              })
          }
          onClose={() => setRecalling(null)}
        />
      )}
    </div>
  );
}
