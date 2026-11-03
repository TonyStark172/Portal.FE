import { portalApi, type NotificationPage } from "@/shared/api/generated/portalApi";

const PAGE_SIZE = 20;

/** What the hub tells the page happened to its bell, as Portal.BE's `NotificationSignalKind` (not in OpenAPI). */
export type NotificationSignalKind = "Added" | "Updated" | "Removed" | "Read";

/** One `notificationsChanged` call. `broadcast` means the whole company was told at once, not only this person. */
export type NotificationSignal = { kind: NotificationSignalKind; broadcast: boolean };

/** "9+" above nine, nothing at none. */
export function formatUnread(count: number): string | null {
  return count === 0 ? null : count > 9 ? "9+" : String(count);
}

/** The count and the list have a tag each, so a signal can read the count alone and a reconnection both. */
export const unreadCountTag = { type: "Notifications", id: "unread-count" } as const;
export const notificationListTag = { type: "Notifications", id: "list" } as const;

/**
 * The bell's list reads page by page with Portal.BE's cursor. Dropped as soon as the panel closes, so reopening reads
 * the first page fresh instead of every page scrolled through. Marking a notification read (generated mutations
 * invalidate the whole "Notifications" tag) reads the count and the loaded pages again.
 */
export const notificationsApi = portalApi.injectEndpoints({
  endpoints: (build) => ({
    getNotificationPages: build.infiniteQuery<NotificationPage, { unreadOnly: boolean }, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
      query: ({ queryArg: { unreadOnly }, pageParam }) => ({
        url: "/api/Notifications",
        params: { pageSize: PAGE_SIZE, unreadOnly, ...(pageParam ? { cursor: pageParam } : {}) },
      }),
      providesTags: [notificationListTag],
      keepUnusedDataFor: 0,
    }),
  }),
  overrideExisting: true,
});

portalApi.enhanceEndpoints({
  endpoints: { getUnreadNotificationCount: { providesTags: [unreadCountTag] } },
});

export const { useGetNotificationPagesInfiniteQuery } = notificationsApi;
