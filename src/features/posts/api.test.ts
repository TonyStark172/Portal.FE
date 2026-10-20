import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { makeStore } from "@/core/store";
import {
  portalApi,
  type CreatePostCommand,
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
  version: 1,
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
