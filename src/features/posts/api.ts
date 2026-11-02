import {
  portalApi,
  type PostCommentPage,
  type PostDto,
  type PostFileDto,
  type PostFileKind,
  type PostFileUrlDto,
  type PostPage,
  type ReactionKind,
  type ReactionPage,
  type ReactionSummaryDto,
} from "@/shared/api/generated/portalApi";
import {
  addComment,
  patchReactions,
  removeComment,
  replaceComment,
  rootsOf,
  setReplies,
  type CommentPages,
} from "./lib/comments";

const PAGE_SIZE = 20;
const REACTIONS_PAGE_SIZE = 50;
const COMMENTS_PAGE_SIZE = 20;

/**
 * The feed, the comments of a post and who reacted read page by page with Portal.BE's cursor, file uploads as
 * multipart/form-data (the generated uploadPostFile sends JSON), and reactions that update the cached post in place
 * instead of refetching the feed.
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
    // Dropped as soon as the popup closes, so reopening reads the first page fresh. `focus` (a comment to open the
    // page of) goes with the first page only: the next pages follow their cursor. Not refetched when a comment
    // changes (see enhanceEndpoints below): that would read again every page scrolled through.
    getComments: build.infiniteQuery<PostCommentPage, { postId: number; focus?: number }, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        refetchCachedPages: false,
      },
      query: ({ queryArg: { postId, focus }, pageParam }) => ({
        url: `/api/Posts/${postId}/comments`,
        params: {
          pageSize: COMMENTS_PAGE_SIZE,
          ...(pageParam ? { cursor: pageParam } : focus ? { focusCommentId: focus } : {}),
        },
      }),
      keepUnusedDataFor: 0,
    }),
    getCommentReactions: build.infiniteQuery<ReactionPage, { commentId: number; kind: ReactionKind | null }, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
      query: ({ queryArg: { commentId, kind }, pageParam }) => ({
        url: `/api/Posts/comments/${commentId}/reactions`,
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

/** Writes the returned counts into every cached copy of the post (feed pages, pinned list and the post alone). */
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

  patchCachedPost(dispatch, postId, (post) => {
    post.reactions = summary.reactions;
    post.myReaction = summary.myReaction;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the thunk dispatch type of the injected API
type Dispatch = (action: any) => any;

/** Changes every cached copy of post `postId`: in the feed pages, the pinned list and the post read alone. */
export function patchCachedPost(dispatch: Dispatch, postId: number, recipe: (post: PostDto) => void) {
  const update = (post: PostDto) => {
    if (post.id === postId) recipe(post);
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
  dispatch(portalApi.util.updateQueryData("getPost", { id: postId }, recipe));
}

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

type GetState = () => unknown;
type CommentsArg = { postId: number; focus?: number };

/** The cached comment entries of post `postId` (of every post when none is given): one per way they were opened. */
const commentsArgs = (getState: GetState, postId?: number): CommentsArg[] =>
  postsApi.util
    .selectCachedArgsForQuery(getState() as never, "getComments")
    .filter((arg) => postId === undefined || arg.postId === postId);

/** Changes the loaded comments of every cached entry of post `postId`, or of every post. */
const patchComments = (dispatch: Dispatch, getState: GetState, postId: number | undefined, recipe: (pages: CommentPages) => void) =>
  commentsArgs(getState, postId).forEach((arg) => dispatch(postsApi.util.updateQueryData("getComments", arg, recipe)));

/** The post whose cached comments hold comment `id`, if any is loaded. */
const postOfComment = (getState: GetState, id: number) =>
  commentsArgs(getState).find((arg) => {
    const pages = postsApi.endpoints.getComments.select(arg)(getState() as never).data;
    return pages && rootsOf(pages).some((root) => root.id === id || root.replies.some((reply) => reply.id === id));
  })?.postId;

/**
 * A comment written, edited, deleted or reacted to changes only that comment in the loaded pages, and the count on
 * the post cards: nothing is read again (so no tag of the generated endpoints is invalidated). A failed request
 * leaves the cache as it was.
 */
portalApi.enhanceEndpoints({
  endpoints: {
    createPostComment: {
      invalidatesTags: [],
      onQueryStarted: async (_arg, { dispatch, getState, queryFulfilled }) => {
        try {
          const { data: comment } = await queryFulfilled;
          patchComments(dispatch, getState, comment.postId, (pages) => addComment(pages, comment));
          patchCachedPost(dispatch, comment.postId, (post) => void (post.commentCount += 1));
        } catch {
          // The popup shows a failed comment.
        }
      },
    },
    updatePostComment: {
      invalidatesTags: [],
      onQueryStarted: async (_arg, { dispatch, getState, queryFulfilled }) => {
        try {
          const { data: comment } = await queryFulfilled;
          patchComments(dispatch, getState, comment.postId, (pages) => replaceComment(pages, comment));
        } catch {
          // As above.
        }
      },
    },
    deletePostComment: {
      invalidatesTags: [],
      onQueryStarted: async ({ id }, { dispatch, getState, queryFulfilled }) => {
        try {
          const { data: deleted } = await queryFulfilled;
          const postId = postOfComment(getState, id);
          if (postId === undefined) return;
          patchComments(dispatch, getState, postId, (pages) => removeComment(pages, id, deleted));
          patchCachedPost(dispatch, postId, (post) => void (post.commentCount -= 1));
        } catch {
          // The comment was not deleted.
        }
      },
    },
    reactToPostComment: {
      invalidatesTags: [],
      onQueryStarted: async ({ id }, { dispatch, getState, queryFulfilled }) => {
        try {
          const { data: summary } = await queryFulfilled;
          patchComments(dispatch, getState, undefined, (pages) => patchReactions(pages, id, summary));
        } catch {
          // The popup shows the error.
        }
      },
    },
    removePostCommentReaction: {
      invalidatesTags: [],
      onQueryStarted: async ({ id }, { dispatch, getState, queryFulfilled }) => {
        try {
          const { data: summary } = await queryFulfilled;
          patchComments(dispatch, getState, undefined, (pages) => patchReactions(pages, id, summary));
        } catch {
          // As above.
        }
      },
    },
    // All the replies of a root, read when "Xem thêm N trả lời" is opened, replace the few its comment lists.
    getPostCommentReplies: {
      providesTags: [],
      onQueryStarted: async ({ id }, { dispatch, getState, queryFulfilled }) => {
        try {
          const { data: replies } = await queryFulfilled;
          patchComments(dispatch, getState, undefined, (pages) => setReplies(pages, id, replies));
        } catch {
          // The popup shows the error.
        }
      },
    },
    setPostCommentsDisabled: {
      invalidatesTags: [],
      onQueryStarted: async ({ id, setPostCommentsDisabledCommand }, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled;
          patchCachedPost(dispatch, id, (post) => {
            post.commentsDisabled = setPostCommentsDisabledCommand.disabled;
          });
        } catch {
          return; // the menu shows the error
        }
        try {
          // The change gave the post a new version: an edit from the old one would be refused as a conflict.
          const { commentsDisabled, version } = await readPost(dispatch, id);
          patchCachedPost(dispatch, id, (post) => {
            post.commentsDisabled = commentsDisabled;
            post.version = version;
          });
        } catch {
          // Read again when the post is next read; the change itself is done.
        }
      },
    },
  },
});

export const {
  useGetFeedInfiniteQuery,
  useGetReactionsInfiniteQuery,
  useGetCommentsInfiniteQuery,
  useGetCommentReactionsInfiniteQuery,
  useGetMediaUrlQuery,
  useUploadPostFileMutation,
  useSetReactionMutation,
  useClearReactionMutation,
} = postsApi;
