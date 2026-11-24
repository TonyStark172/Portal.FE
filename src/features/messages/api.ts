import {
  portalApi,
  type ChatAttachmentUrlDto,
  type ChatMessageDto,
  type ChatMessagePage,
  type ConversationPage,
  type SharedChatContentKind,
  type SharedChatItemPage,
} from "@/shared/api/generated/portalApi";

const CONVERSATIONS_PAGE_SIZE = 30;
export const MESSAGES_PAGE_SIZE = 30;
const SHARED_PAGE_SIZE = 30;
const SEARCH_PAGE_SIZE = 20;

/** Which messages of a conversation a thread shows: the latest ones, or a window around one message (a jump to it). */
export type MessagesArg = { conversationId: number; around: number | null };
/** Where a further page starts: older than a message, or newer than one. Null for the first page. */
export type MessagesPageParam = { before: number } | { after: number } | null;

/**
 * The lists of conversations, a conversation's details, pins and shared content provide the "Conversations" tag the
 * generated mutations invalidate, so sending, reading and the hub's "Messages" signal (useNotificationsHub) read them
 * again. The messages of a thread do not: an infinite query read again fetches every page it has loaded, which for a
 * long history is the whole history on every new message. They are kept up to date message by message instead (see
 * useThreadMessages).
 */
export const messagesApi = portalApi.injectEndpoints({
  endpoints: (build) => ({
    getConversationPages: build.infiniteQuery<ConversationPage, { search: string }, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
      query: ({ queryArg: { search }, pageParam }) => ({
        url: "/api/Conversations",
        params: { pageSize: CONVERSATIONS_PAGE_SIZE, ...(search ? { search } : {}), ...(pageParam ? { cursor: pageParam } : {}) },
      }),
      providesTags: ["Conversations"],
    }),
    /**
     * A conversation's messages, newest first, from the latest ones or from around one message. The "next" pages go back
     * in time, the "previous" ones towards the present (only a window around a message has any), so the pages kept are
     * always in order: newest page first.
     */
    getChatMessagePages: build.infiniteQuery<ChatMessagePage, MessagesArg, MessagesPageParam>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => (lastPage.nextBefore ? { before: lastPage.nextBefore } : undefined),
        getPreviousPageParam: (firstPage) => (firstPage.nextAfter ? { after: firstPage.nextAfter } : undefined),
      },
      query: ({ queryArg: { conversationId, around }, pageParam }) => ({
        url: `/api/Conversations/${conversationId}/messages`,
        params: { pageSize: MESSAGES_PAGE_SIZE, ...(pageParam ?? (around ? { around } : {})) },
      }),
    }),
    /**
     * The latest page as it is now, and one message as it is now: what a thread reads when it is told that something
     * changed. Without tags on purpose: the same signal invalidates "Conversations", which drops unsubscribed entries
     * that provide it, and with them the answer of a read that was still on its way.
     */
    readLatestChatMessages: build.query<ChatMessagePage, number>({
      query: (conversationId) => ({ url: `/api/Conversations/${conversationId}/messages`, params: { pageSize: MESSAGES_PAGE_SIZE } }),
      keepUnusedDataFor: 0,
    }),
    readChatMessage: build.query<ChatMessageDto, number>({
      query: (messageId) => `/api/Conversations/messages/${messageId}`,
      keepUnusedDataFor: 0,
    }),
    /** The messages of a conversation that contain every word of `text`, newest first. */
    searchChatMessagePages: build.infiniteQuery<ChatMessagePage, { conversationId: number; text: string }, number | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextBefore ?? undefined,
      },
      query: ({ queryArg: { conversationId, text }, pageParam }) => ({
        url: `/api/Conversations/${conversationId}/search`,
        params: { text, pageSize: SEARCH_PAGE_SIZE, ...(pageParam ? { before: pageParam } : {}) },
      }),
    }),
    /**
     * The images and videos, files or links shared in a conversation, newest first. Without the tag as well: it is read
     * when its panel opens and when a message comes while it is open, not for every "seen". Read again, it starts over
     * from its first page instead of fetching every page it had.
     */
    getSharedChatContentPages: build.infiniteQuery<SharedChatItemPage, { conversationId: number; kind: SharedChatContentKind }, number | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextBefore ?? undefined,
        refetchCachedPages: false,
      },
      query: ({ queryArg: { conversationId, kind }, pageParam }) => ({
        url: `/api/Conversations/${conversationId}/shared`,
        params: { kind, pageSize: SHARED_PAGE_SIZE, ...(pageParam ? { before: pageParam } : {}) },
      }),
    }),
    // A presigned storage URL lasts an hour; it is read again after 50 minutes so a <video> never gets an expired one.
    getChatMediaUrl: build.query<ChatAttachmentUrlDto, string>({
      query: (id) => `/api/Conversations/attachments/${id}/url`,
      keepUnusedDataFor: 50 * 60,
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetConversationPagesInfiniteQuery,
  useGetChatMessagePagesInfiniteQuery,
  useSearchChatMessagePagesInfiniteQuery,
  useGetSharedChatContentPagesInfiniteQuery,
  useGetChatMediaUrlQuery,
} = messagesApi;

export const chatAttachmentPath = (id: string) => `/api/Conversations/attachments/${id}`;
/** The smaller copy of an image (the image itself when it is small already). */
export const chatThumbnailPath = (id: string) => `/api/Conversations/attachments/${id}/thumbnail`;

/** What a badge says: nothing at none, the number up to 99, then "99+". */
export const formatUnreadConversations = (count: number): string | null => (count === 0 ? null : count > 99 ? "99+" : String(count));
