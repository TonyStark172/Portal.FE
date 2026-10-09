import {
  portalApi,
  type PostDto,
  type PostFileDto,
  type PostFileKind,
  type PostFileUrlDto,
  type PostPage,
  type ReactionKind,
  type ReactionPage,
  type ReactionSummaryDto,
} from "@/shared/api/generated/portalApi";

const PAGE_SIZE = 20;
const REACTIONS_PAGE_SIZE = 50;

/**
 * The feed and who reacted read page by page with Portal.BE's cursor, file uploads as multipart/form-data (the
 * generated uploadPostFile sends JSON), and reactions that update the cached post in place instead of refetching
 * the feed.
 */
export const postsApi = portalApi.injectEndpoints({
  endpoints: (build) => ({
    getFeed: build.infiniteQuery<PostPage, void, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
      query: ({ pageParam }) => ({
        url: "/api/Posts",
        params: { pageSize: PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
      }),
      providesTags: ["Posts"],
    }),
    // Dropped as soon as the list closes, so reopening reads the first page fresh instead of refetching every page.
    getReactions: build.infiniteQuery<ReactionPage, { postId: number; kind: ReactionKind | null }, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
      query: ({ queryArg: { postId, kind }, pageParam }) => ({
        url: `/api/Posts/${postId}/reactions`,
        params: { pageSize: REACTIONS_PAGE_SIZE, ...(kind ? { kind } : {}), ...(pageParam ? { cursor: pageParam } : {}) },
      }),
      keepUnusedDataFor: 0,
    }),
    // A presigned storage URL lasts an hour; it is read again after 50 minutes so a <video> never gets an expired one.
    getMediaUrl: build.query<PostFileUrlDto, string>({
      query: (id) => `/api/Posts/files/${id}/url`,
      keepUnusedDataFor: 50 * 60,
    }),
    uploadPostFile: build.mutation<PostFileDto, { file: File; kind: PostFileKind }>({
      query: ({ file, kind }) => {
        const body = new FormData();
        body.append("file", file);
        body.append("kind", kind);
        return { url: "/api/Posts/files", method: "POST", body };
      },
    }),
    setReaction: build.mutation<ReactionSummaryDto, { postId: number; kind: ReactionKind }>({
      query: ({ postId, kind }) => ({ url: `/api/Posts/${postId}/reaction`, method: "PUT", body: { kind } }),
      onQueryStarted: ({ postId }, { dispatch, queryFulfilled }) => applySummary(postId, dispatch, queryFulfilled),
    }),
    clearReaction: build.mutation<ReactionSummaryDto, { postId: number }>({
      query: ({ postId }) => ({ url: `/api/Posts/${postId}/reaction`, method: "DELETE" }),
      onQueryStarted: ({ postId }, { dispatch, queryFulfilled }) => applySummary(postId, dispatch, queryFulfilled),
    }),
  }),
  overrideExisting: true,
});

/** Writes the returned counts into every cached copy of the post (feed pages and pinned list). */
async function applySummary(
  postId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the thunk dispatch type of the injected API
  dispatch: (action: any) => unknown,
  queryFulfilled: Promise<{ data: ReactionSummaryDto }>,
) {
  let summary: ReactionSummaryDto;
  try {
    ({ data: summary } = await queryFulfilled);
  } catch {
    return; // the component shows the error
  }

  const update = (post: PostDto) => {
    if (post.id !== postId) return;
    post.reactions = summary.reactions;
    post.myReaction = summary.myReaction;
  };

  dispatch(
    postsApi.util.updateQueryData("getFeed", undefined, (draft) => {
      draft.pages.forEach((page) => page.items.forEach(update));
    }),
  );
  dispatch(
    portalApi.util.updateQueryData("getPinnedPosts", undefined, (draft) => {
      draft.forEach(update);
    }),
  );
}

export const {
  useGetFeedInfiniteQuery,
  useGetReactionsInfiniteQuery,
  useGetMediaUrlQuery,
  useUploadPostFileMutation,
  useSetReactionMutation,
  useClearReactionMutation,
} = postsApi;
