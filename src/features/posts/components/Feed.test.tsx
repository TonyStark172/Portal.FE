import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { portalApi, type PostDto, type PostPage, type UserDto } from "@/shared/api/generated/portalApi";
import { signedIn } from "@/shared/session/sessionSlice";
import { Feed } from "./Feed";

const post = (id: number): PostDto => ({
  id,
  kind: "Normal" as PostDto["kind"],
  contentHtml: `<p>Bài số ${id}</p>`,
  author: { id: 1, fullName: "Nguyễn Văn An" } as PostDto["author"],
  createdAt: "2026-10-01T08:00:00Z",
  media: [],
  attachments: [],
  mentions: [],
  mentionsEveryone: false,
  reactions: [],
  myReaction: null,
  isPinned: false,
  canPin: false,
  canEdit: false,
  canDelete: false,
  version: 1,
});

/** Portal.BE answering the feed with one page of `count` posts and nothing else pinned. */
function serve(count: number) {
  const page: PostPage = { items: Array.from({ length: count }, (_, i) => post(count - i)), nextCursor: null };
  vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/pinned")) return Response.json([]);
    if (url.includes("/api/Posts")) return Response.json(page);
    return new Response(null, { status: 404 });
  });
}

async function signedInStore() {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(
    portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 1, fullName: "Nguyễn Văn An" } as UserDto,
      permissions: [],
    }),
  );
  return store;
}

const shown = () => [...document.querySelectorAll(".post-content")].map((el) => el.textContent);

afterEach(() => {
  vi.restoreAllMocks();
  window.scrollTo(0, 0);
});

describe("the feed", () => {
  test("keeps only the posts near the viewport in the page, however many are loaded", async () => {
    serve(500);
    await render(
      <Provider store={await signedInStore()}>
        <Feed />
      </Provider>,
    );

    await vi.waitUntil(() => shown().includes("Bài số 500"), { timeout: 5000 });
    expect(shown().length).toBeLessThan(30);
  });

  test("shows placeholder posts under the list while the next page loads", async () => {
    vi.spyOn(window, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/pinned")) return Response.json([]);
      if (url.includes("cursor=")) return new Promise<Response>(() => {}); // the next page never arrives
      if (url.includes("/api/Posts"))
        return Response.json({ items: Array.from({ length: 20 }, (_, i) => post(20 - i)), nextCursor: "p2" });
      return new Response(null, { status: 404 });
    });
    await render(
      <Provider store={await signedInStore()}>
        <Feed />
      </Provider>,
    );
    await vi.waitUntil(() => shown().includes("Bài số 20"), { timeout: 5000 });

    const loading = await vi.waitUntil(
      () => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        return document.querySelector<HTMLElement>('[role="status"]');
      },
      { timeout: 5000 },
    );
    expect(loading.querySelectorAll('[data-slot="card"]').length).toBeGreaterThanOrEqual(2);
  });
});
