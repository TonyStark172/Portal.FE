import "@/app/globals.css";
import { Provider } from "react-redux";
import { Toast, toast } from "@heroui/react";
import { afterEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import type { PostCommentDto, PostCommentPage, PostDto } from "@/shared/api/generated/portalApi";
import { makeComment, makePost, makeTombstone } from "./comments.testing";
import { CommentList } from "./CommentList";

type Server = {
  /** The comments endpoint: the page asked for (`cursor`, `focusCommentId`) as a response. */
  comments?: (params: URLSearchParams) => Response;
  /** The replies endpoint, by root id. */
  replies?: (rootId: number) => PostCommentDto[];
  /** Any other call, by method and path. */
  other?: (method: string, path: string) => Response | undefined;
};

/** Portal.BE for the list: calls are recorded as "METHOD /path". */
function serve(server: Server) {
  const calls: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), window.location.href), init);
    const url = new URL(request.url);
    const path = url.pathname.slice(url.pathname.indexOf("/api/"));
    calls.push(`${request.method} ${path}`);

    if (request.method === "GET" && /^\/api\/Posts\/\d+\/comments$/.test(path)) return server.comments?.(url.searchParams) ?? Response.json(pageOf([]));
    const replies = /^\/api\/Posts\/comments\/(\d+)\/replies$/.exec(path);
    if (replies && server.replies) return Response.json(server.replies(Number(replies[1])));
    return server.other?.(request.method, path) ?? new Response(null, { status: 404 });
  });
  return calls;
}

const pageOf = (items: PostCommentDto[], nextCursor: string | null = null): PostCommentPage => ({ items, nextCursor });

async function renderList(over: { post?: PostDto; focusId?: number; onMissing?: () => void; store?: ReturnType<typeof makeStore> } = {}) {
  const handlers = { onReply: vi.fn(), onEdit: vi.fn(), onMissing: over.onMissing ?? vi.fn() };
  const store = over.store ?? makeStore();
  const ui = (
    <Provider store={store}>
      <Toast.Provider />
      <CommentList post={over.post ?? makePost()} focusId={over.focusId} {...handlers} />
    </Provider>
  );
  return { screen: await render(ui), handlers };
}

afterEach(() => {
  vi.restoreAllMocks();
  toast.clear();
});

test("shows the empty line when there are no comments", async () => {
  serve({ comments: () => Response.json(pageOf([])) });
  await renderList();

  await expect.element(page.getByText("Chưa có bình luận nào")).toBeVisible();
  expect(page.getByRole("button", { name: "Xem thêm bình luận" }).query()).toBeNull();
});

test("lists the roots oldest first", async () => {
  serve({ comments: () => Response.json(pageOf([makeComment(1), makeComment(2)])) });
  await renderList();

  await expect.element(page.getByText("Bình luận 1")).toBeVisible();
  const [first, second] = [page.getByText("Bình luận 1").element(), page.getByText("Bình luận 2").element()];
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("loads more roots and removes the button at the end", async () => {
  const calls = serve({
    comments: (params) =>
      params.get("cursor") === "next"
        ? Response.json(pageOf([makeComment(3)]))
        : Response.json(pageOf([makeComment(1), makeComment(2)], "next")),
  });
  await renderList();
  await expect.element(page.getByText("Bình luận 2")).toBeVisible();
  expect(page.getByText("Bình luận 3").query()).toBeNull();

  await page.getByRole("button", { name: "Xem thêm bình luận" }).click();

  await expect.element(page.getByText("Bình luận 3")).toBeVisible();
  expect(page.getByRole("button", { name: "Xem thêm bình luận" }).query()).toBeNull();
  expect(calls.filter((call) => call.endsWith("/comments"))).toHaveLength(2);
});

test("collapses replies past two and loads the rest", async () => {
  const all = [3, 4, 5, 6, 7].map((id) => makeComment(id, { parentId: 1 }));
  const calls = serve({
    comments: () => Response.json(pageOf([makeComment(1, { replyCount: 5, replies: all.slice(0, 2) })])),
    replies: () => all,
  });
  await renderList();
  await expect.element(page.getByText("Bình luận 4")).toBeVisible();
  expect(page.getByText("Bình luận 5").query()).toBeNull();

  await page.getByRole("button", { name: "Xem thêm 3 trả lời" }).click();

  await expect.element(page.getByText("Bình luận 7")).toBeVisible();
  expect(page.getByText(/Bình luận \d/).elements()).toHaveLength(6);
  expect(page.getByRole("button", { name: /Xem thêm \d+ trả lời/ }).query()).toBeNull();
  expect(calls.filter((call) => call.endsWith("/replies"))).toHaveLength(1);
});

test("a thread read again after the popup was closed loads its replies again", async () => {
  const all = [3, 4, 5].map((id) => makeComment(id, { parentId: 1 }));
  const calls = serve({
    comments: () => Response.json(pageOf([makeComment(1, { replyCount: 3, replies: all.slice(0, 2) })])),
    replies: () => all,
  });
  const store = makeStore(); // the same one when it is opened again, as in the app
  const first = await renderList({ store });
  await page.getByRole("button", { name: "Xem thêm 1 trả lời" }).click();
  await expect.element(page.getByText("Bình luận 5")).toBeVisible();
  await first.screen.unmount();
  // The comments are dropped as soon as nothing shows them; the replies stay in the cache for a minute.
  await new Promise((resolve) => setTimeout(resolve, 50));

  const again = await renderList({ store });
  await expect.element(page.getByRole("button", { name: "Xem thêm 1 trả lời" })).toBeVisible();
  expect(page.getByText("Bình luận 5").query()).toBeNull();
  await page.getByRole("button", { name: "Xem thêm 1 trả lời" }).click();

  await expect.element(page.getByText("Bình luận 5")).toBeVisible();
  expect(calls.filter((call) => call.endsWith("/replies"))).toHaveLength(2);
  await again.screen.unmount();
});

test("a reply added to a thread with only some replies loaded counts the ones not loaded", async () => {
  const all = [3, 4, 5, 6, 7].map((id) => makeComment(id, { parentId: 1 }));
  serve({
    comments: () => Response.json(pageOf([makeComment(1, { replyCount: 6, replies: [...all.slice(0, 2), makeComment(8, { parentId: 1 })] })])),
    replies: () => [...all, makeComment(8, { parentId: 1 })],
  });
  await renderList();

  await expect.element(page.getByText("Bình luận 8")).toBeVisible();
  await page.getByRole("button", { name: "Xem thêm 3 trả lời" }).click();

  await expect.element(page.getByText("Bình luận 7")).toBeVisible();
  expect(page.getByText(/Bình luận \d/).elements()).toHaveLength(7);
});

test("a tombstone shows only its line, and its replies stay answerable", async () => {
  serve({
    comments: () =>
      Response.json(pageOf([makeTombstone(1, { replyCount: 1, replies: [makeComment(2, { parentId: 1, contentHtml: "<p>Trả lời còn lại</p>" })] })])),
  });
  const { handlers } = await renderList();

  await expect.element(page.getByText("Bình luận đã bị xoá")).toBeVisible();
  await expect.element(page.getByText("Trả lời còn lại")).toBeVisible();
  const replyButtons = page.getByRole("button", { name: "Trả lời" });
  expect(replyButtons.elements()).toHaveLength(1);

  await replyButtons.click();
  expect(handlers.onReply).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
});

test("with comments off the rows have no Trả lời", async () => {
  serve({ comments: () => Response.json(pageOf([makeComment(1, { replyCount: 1, replies: [makeComment(2, { parentId: 1 })] })])) });
  await renderList({ post: makePost({ commentsDisabled: true }) });

  await expect.element(page.getByText("Bình luận 2")).toBeVisible();
  expect(page.getByRole("button", { name: "Trả lời" }).query()).toBeNull();
  expect(page.getByRole("button", { name: "Bày tỏ cảm xúc" }).elements()).toHaveLength(2);
});

test("a reaction on a comment is sent to it and shown", async () => {
  const calls = serve({
    comments: () => Response.json(pageOf([makeComment(1)])),
    other: (method, path) =>
      method === "PUT" && path.endsWith("/comments/1/reaction") ? Response.json({ reactions: [{ kind: "Love", count: 1 }], myReaction: "Love" }) : undefined,
  });
  await renderList();

  await page.getByRole("button", { name: "Bày tỏ cảm xúc" }).click();
  await page.getByRole("button", { name: "Yêu thích" }).click();

  await expect.element(page.getByRole("button", { name: "Yêu thích" })).toBeVisible();
  expect(calls).toContain("PUT /api/Posts/comments/1/reaction");
});

test("reaching a focused comment scrolls to and highlights it", async () => {
  const scroll = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
  const calls: URLSearchParams[] = [];
  serve({
    comments: (params) => {
      calls.push(params);
      return Response.json(pageOf([makeComment(1), makeComment(2), makeComment(3)]));
    },
  });
  await renderList({ focusId: 2 });

  await vi.waitFor(() => expect(document.querySelector('[data-comment-id="2"]')?.hasAttribute("data-highlighted")).toBe(true));
  expect(document.querySelector('[data-comment-id="1"]')?.hasAttribute("data-highlighted")).toBe(false);
  expect(scroll).toHaveBeenCalledTimes(1);
  expect(scroll.mock.contexts[0]).toBe(document.querySelector('[data-comment-id="2"]'));
  expect(calls[0].get("focusCommentId")).toBe("2");

  // The highlight is only for a moment.
  await vi.waitFor(() => expect(document.querySelector('[data-comment-id="2"]')?.hasAttribute("data-highlighted")).toBe(false), { timeout: 4000 });
  expect(scroll).toHaveBeenCalledTimes(1);
});

test("a focused reply is reached too", async () => {
  const scroll = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
  const reply = makeComment(9, { parentId: 1 });
  serve({ comments: () => Response.json(pageOf([makeComment(1, { replyCount: 1, replies: [reply] })])) });
  await renderList({ focusId: 9 });

  await vi.waitFor(() => expect(document.querySelector('[data-comment-id="9"]')?.hasAttribute("data-highlighted")).toBe(true));
  expect(scroll.mock.contexts[0]).toBe(document.querySelector('[data-comment-id="9"]'));
});

test("a focused comment that is gone reports it and closes", async () => {
  serve({ comments: () => Response.json({ status: 404, code: "not_found" }, { status: 404 }) });
  const onMissing = vi.fn();
  await renderList({ focusId: 99, onMissing });

  await expect.element(page.getByText("Bình luận không còn tồn tại")).toBeVisible();
  expect(onMissing).toHaveBeenCalledTimes(1);
});

test("offers a retry when the comments cannot be read", async () => {
  let fail = true;
  serve({ comments: () => (fail ? new Response(null, { status: 500 }) : Response.json(pageOf([makeComment(1)]))) });
  const onMissing = vi.fn();
  await renderList({ onMissing });

  const retry = page.getByRole("button", { name: "Thử lại" });
  await expect.element(retry).toBeVisible();
  fail = false;
  await retry.click();

  await expect.element(page.getByText("Bình luận 1")).toBeVisible();
  expect(onMissing).not.toHaveBeenCalled();
});
