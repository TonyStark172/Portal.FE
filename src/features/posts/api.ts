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
    // Not refetched when a post changes (see the mutations below): that would read again every page scrolled
    // through, one after the other. A refetch for another reason (retry, reconnecting) reads the first page only.
    getFeed: build.infiniteQuery<PostPage, void, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        refetchCachedPages: false,
      },
      query: ({ pageParam }) => ({
        url: "/api/Posts",
        params: { pageSize: PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
      }),
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the thunk dispatch type of the injected API
type Dispatch = (action: any) => any;

const isNewer = (a: PostDto, b: PostDto) => {
  const difference = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  return difference > 0 || (difference === 0 && a.id > b.id);
};

/** Takes post `id` out of the loaded feed. */
const removeFromFeed = (id: number) =>
  postsApi.util.updateQueryData("getFeed", undefined, (draft) => {
    draft.pages.forEach((page) => {
      page.items = page.items.filter((item) => item.id !== id);
    });
  });

/** Writes `post` where it belongs in the loaded feed, newest first; left out when it is older than what is loaded. */
const placeInFeed = (post: PostDto) =>
  postsApi.util.updateQueryData("getFeed", undefined, (draft) => {
    draft.pages.forEach((page) => {
      page.items = page.items.filter((item) => item.id !== post.id);
    });
    for (const page of draft.pages) {
      const index = page.items.findIndex((item) => isNewer(post, item));
      if (index >= 0) {
        page.items.splice(index, 0, post);
        return;
      }
    }
    // Older than every loaded post: it is at the end only when the whole feed is loaded.
    const last = draft.pages.at(-1);
    if (last && last.nextCursor === null) last.items.push(post);
  });

/** Replaces the loaded copy of `post` (if any), keeping its place. */
const replaceInFeed = (post: PostDto) =>
  postsApi.util.updateQueryData("getFeed", undefined, (draft) => {
    draft.pages.forEach((page) => {
      page.items = page.items.map((item) => (item.id === post.id ? post : item));
    });
  });

/** The post as Portal.BE now has it (with the reader's reactions and rights). */
const readPost = (dispatch: Dispatch, id: number): Promise<PostDto> =>
  dispatch(portalApi.endpoints.getPost.initiate({ id }, { subscribe: false, forceRefetch: true })).unwrap();

/**
 * A post written, deleted, pinned or unpinned changes only that post in the loaded feed: the post is read again
 * (one request) instead of every page of the feed. A failed request leaves the feed as it was.
 */
portalApi.enhanceEndpoints({
  endpoints: {
    createPost: {
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          const { data: id } = await queryFulfilled;
          dispatch(placeInFeed(await readPost(dispatch, id)));
        } catch {
          // The composer shows a failed post; a post that cannot be read shows up when the feed is next read.
        }
      },
    },
    updatePost: {
      onQueryStarted: async ({ id }, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled;
          dispatch(replaceInFeed(await readPost(dispatch, id)));
        } catch {
          // As above.
        }
      },
    },
    deletePost: {
      onQueryStarted: async ({ id }, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled;
          dispatch(removeFromFeed(id));
        } catch {
          // The post was not deleted.
        }
      },
    },
    // A pinned post is listed apart, above the feed (getPinnedPosts, refetched by its tag).
    pinPost: {
      onQueryStarted: async ({ id }, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled;
          dispatch(removeFromFeed(id));
        } catch {
          // The post was not pinned.
        }
      },
    },
    unpinPost: {
      onQueryStarted: async ({ id }, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled;
          dispatch(placeInFeed(await readPost(dispatch, id)));
        } catch {
          // As above.
        }
      },
    },
  },
});

export const {
  useGetFeedInfiniteQuery,
  useGetReactionsInfiniteQuery,
  useGetMediaUrlQuery,
  useUploadPostFileMutation,
  useSetReactionMutation,
  useClearReactionMutation,
} = postsApi;
