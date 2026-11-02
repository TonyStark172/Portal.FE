import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { makeStore } from "@/core/store";
import {
  portalApi,
  type CreatePostCommand,
  type PostCommentDto,
  type PostDto,
  type UpdatePostCommand,
} from "@/shared/api/generated/portalApi";
import { signedIn } from "@/shared/session/sessionSlice";
import { postsApi } from "./api";

/** Post `id`, the higher the id the newer; `text` is its content. */
const post = (id: number, text = `Bài ${id}`): PostDto => ({
  id,
  kind: "Normal",
  contentHtml: `<p>${text}</p>`,
  author: { id: 1, fullName: "Nguyễn Văn An" } as PostDto["author"],
  createdAt: new Date(Date.UTC(2026, 9, 1) + id * 60_000).toISOString(),
  media: [],
  attachments: [],
  mentions: [],
  mentionsEveryone: false,
  reactions: [],
  myReaction: null,
  isPinned: false,
  canPin: true,
  canEdit: true,
  canDelete: true,
  commentCount: 0,
  commentsDisabled: false,
  canToggleComments: false,
  version: 1,
});

/** Comment `id` of post 45; a reply names its root in `parentId`. */
const comment = (id: number, parentId: number | null = null): PostCommentDto => ({
  id,
  postId: 45,
  parentId,
  contentHtml: `<p>Bình luận ${id}</p>`,
  author: { id: 2, fullName: "Trần Thị Bình" } as PostCommentDto["author"],
  isPostAuthor: false,
  createdAt: new Date(Date.UTC(2026, 10, 1) + id * 60_000).toISOString(),
  editedAt: null,
  isDeleted: false,
  file: null,
  reactions: [],
  myReaction: null,
  replyCount: 0,
  replies: [],
  canEdit: true,
  canDelete: true,
});

const range = (from: number, to: number) => Array.from({ length: from - to + 1 }, (_, i) => from - i);

// The feed holds posts 60 to 1, newest first, 20 a page; post 30 is pinned, so it is not in the feed.
const feedPages: Record<string, { ids: number[]; next: string | null }> = {
  first: { ids: range(60, 41), next: "p2" },
  p2: { ids: range(40, 21).filter((id) => id !== 30), next: "p3" },
  p3: { ids: range(20, 1), next: null },
};

/** Every request made to Portal.BE, as "METHOD /path?query". */
let requests: string[] = [];

beforeEach(() => {
  requests = [];
  vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const url = new URL(request.url);
    const path = url.pathname.replace(/^.*\/api\//, "/api/");
    requests.push(`${request.method} ${path}${url.search}`);

    if (request.method === "GET" && path === "/api/Posts") {
      const page = feedPages[url.searchParams.get("cursor") ?? "first"];
      return Response.json({ items: page.ids.map((id) => post(id)), nextCursor: page.next });
    }
    const one = path.match(/^\/api\/Posts\/(\d+)$/);
    if (request.method === "GET" && one) return Response.json(post(Number(one[1]), `Bài ${one[1]} đã sửa`));
    if (request.method === "POST" && path === "/api/Posts") return Response.json(61, { status: 201 });

    if (request.method === "GET" && path === "/api/Posts/45/comments") {
      return url.searchParams.get("cursor") === "c2"
        ? Response.json({ items: [comment(3)], nextCursor: null })
        : Response.json({ items: [{ ...comment(1), replyCount: 3, replies: [comment(11, 1)] }, comment(2)], nextCursor: "c2" });
    }
    if (request.method === "POST" && path === "/api/Posts/45/comments") return Response.json(comment(9));
    if (request.method === "GET" && path === "/api/Posts/comments/1/replies") {
      return Response.json([comment(11, 1), comment(12, 1), comment(13, 1)]);
    }
    if (request.method === "DELETE" && path === "/api/Posts/comments/2") {
      return Response.json({ tombstoned: false, removedParentId: null });
    }
    if (path === "/api/Posts/comments/2/reaction") {
      return Response.json({ reactions: [{ kind: "Love", count: 1 }], myReaction: "Love" });
    }
    return new Response(null, { status: 204 });
  });
});

afterEach(() => vi.restoreAllMocks());

/** A signed-in store whose feed has its three pages loaded. */
async function storeWithFeed() {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(postsApi.endpoints.getFeed.initiate());
  await store.dispatch(postsApi.endpoints.getFeed.initiate(undefined, { direction: "forward" }));
  await store.dispatch(postsApi.endpoints.getFeed.initiate(undefined, { direction: "forward" }));
  requests = [];
  return store;
}

type Store = Awaited<ReturnType<typeof storeWithFeed>>;

const feed = (store: Store) =>
  postsApi.endpoints.getFeed.select()(store.getState() as never).data!.pages.flatMap((page) => page.items);

/** Requests reading pages of the feed (not one post). */
const feedReads = () => requests.filter((r) => r.startsWith("GET /api/Posts?") || r === "GET /api/Posts");

const body = { kind: "Normal", contentHtml: "<p>x</p>", media: [] } as unknown as CreatePostCommand;

describe("the feed after a post changes", () => {
  test("shows an edited post in place, reading only that post again", async () => {
    const store = await storeWithFeed();

    await store.dispatch(
      portalApi.endpoints.updatePost.initiate({ id: 45, updatePostCommand: { ...body, version: 1 } as UpdatePostCommand }),
    );
    await vi.waitUntil(() => feed(store).find((p) => p.id === 45)?.contentHtml === "<p>Bài 45 đã sửa</p>");

    expect(feedReads()).toEqual([]);
    expect(requests).toContain("GET /api/Posts/45");
    expect(feed(store).map((p) => p.id)).toEqual([...range(60, 31), ...range(29, 1)]);
  });

  test("puts a new post on top without reading the feed again", async () => {
    const store = await storeWithFeed();

    await store.dispatch(portalApi.endpoints.createPost.initiate({ createPostCommand: body }));
    await vi.waitUntil(() => feed(store)[0]?.id === 61);

    expect(feedReads()).toEqual([]);
    expect(feed(store)).toHaveLength(60);
  });

  test("drops a deleted post without reading the feed again", async () => {
    const store = await storeWithFeed();

    await store.dispatch(portalApi.endpoints.deletePost.initiate({ id: 22 }));
    await vi.waitUntil(() => !feed(store).some((p) => p.id === 22));

    expect(feedReads()).toEqual([]);
    expect(feed(store).map((p) => p.id)).not.toContain(22);
    expect(feed(store)).toHaveLength(58);
  });

  test("moves a pinned post out of the feed, and an unpinned one back to its place", async () => {
    const store = await storeWithFeed();

    await store.dispatch(portalApi.endpoints.pinPost.initiate({ id: 50, pinPostCommand: { until: null } }));
    await vi.waitUntil(() => !feed(store).some((p) => p.id === 50));

    await store.dispatch(portalApi.endpoints.unpinPost.initiate({ id: 30 }));
    await vi.waitUntil(() => feed(store).some((p) => p.id === 30));

    expect(feedReads()).toEqual([]);
    const ids = feed(store).map((p) => p.id);
    expect(ids.indexOf(30)).toBe(ids.indexOf(31) + 1);
    expect(ids.indexOf(29)).toBe(ids.indexOf(30) + 1);
  });

  test("on a later refetch reads the first page only, not every page scrolled through", async () => {
    const store = await storeWithFeed();

    await store.dispatch(postsApi.endpoints.getFeed.initiate(undefined, { forceRefetch: true }));

    expect(feedReads()).toEqual(["GET /api/Posts?pageSize=20"]);
  });
});

describe("the comments of a post", () => {
  /** A signed-in store with the first page of the comments of post 45 (and the feed) loaded. */
  async function storeWithComments(focus?: number) {
    const store = await storeWithFeed();
    await store.dispatch(postsApi.endpoints.getComments.initiate({ postId: 45, focus }));
    return store;
  }

  const comments = (store: Store) =>
    postsApi.endpoints.getComments.select({ postId: 45 })(store.getState() as never).data!.pages.flatMap((p) => p.items);
  const commentCount = (store: Store) => feed(store).find((p) => p.id === 45)!.commentCount;

  test("sends the comment to open with the first page only", async () => {
    const store = await storeWithComments(2);
    await store.dispatch(postsApi.endpoints.getComments.initiate({ postId: 45, focus: 2 }, { direction: "forward" }));

    expect(requests).toEqual(["GET /api/Posts/45/comments?pageSize=20&focusCommentId=2", "GET /api/Posts/45/comments?pageSize=20&cursor=c2"]);
  });

  test("a new comment is listed and counted on the post without reading anything again", async () => {
    const store = await storeWithComments();

    await store.dispatch(portalApi.endpoints.createPostComment.initiate({ postId: 45, createPostCommentCommand: { contentHtml: "<p>x</p>" } }));
    await vi.waitUntil(() => commentCount(store) === 1);

    expect(comments(store).map((c) => c.id)).toEqual([1, 2, 9]);
    expect(requests).toEqual(["GET /api/Posts/45/comments?pageSize=20", "POST /api/Posts/45/comments"]);
  });

  test("a deleted comment goes from the list and from the count of the post", async () => {
    const store = await storeWithComments();
    await store.dispatch(portalApi.endpoints.createPostComment.initiate({ postId: 45, createPostCommentCommand: { contentHtml: "<p>x</p>" } }));
    await vi.waitUntil(() => commentCount(store) === 1);

    await store.dispatch(portalApi.endpoints.deletePostComment.initiate({ id: 2 }));
    await vi.waitUntil(() => commentCount(store) === 0);

    expect(comments(store).map((c) => c.id)).toEqual([1, 9]);
  });

  test("the whole thread of a root replaces its preview", async () => {
    const store = await storeWithComments();

    await store.dispatch(portalApi.endpoints.getPostCommentReplies.initiate({ id: 1 }));
    await vi.waitUntil(() => comments(store)[0].replies.length === 3);

    expect(comments(store)[0].replies.map((r) => r.id)).toEqual([11, 12, 13]);
  });

  test("a reaction is written to the comment", async () => {
    const store = await storeWithComments();

    await store.dispatch(portalApi.endpoints.reactToPostComment.initiate({ id: 2, reactToPostCommentCommand: { kind: "Love" } }));
    await vi.waitUntil(() => comments(store)[1].myReaction === "Love");

    expect(comments(store)[1].reactions).toEqual([{ kind: "Love", count: 1 }]);
  });

  test("turning comments off shows on the post of the feed", async () => {
    const store = await storeWithComments();

    await store.dispatch(
      portalApi.endpoints.setPostCommentsDisabled.initiate({ id: 45, setPostCommentsDisabledCommand: { disabled: true } }),
    );
    await vi.waitUntil(() => feed(store).find((p) => p.id === 45)!.commentsDisabled);
  });
});
