import "@/app/globals.css";
import { Provider } from "react-redux";
import { Toast, toast } from "@heroui/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { portalApi, type PostDto, type UserDto } from "@/shared/api/generated/portalApi";
import { signedIn } from "@/shared/session/sessionSlice";
import { historyNavigation } from "../../hooks/navigation.testing";
import { Feed } from "../Feed";
import { makeComment } from "./comments.testing";
import { CommentsDialog } from "./CommentsDialog";

vi.mock("next/navigation", () => historyNavigation);

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
  commentCount: 0,
  commentsDisabled: false,
  canToggleComments: false,
  version: 1,
});

// The test page's own address carries the runner's parameters: kept, with the popup's added to them.
const start = window.location.href;
const goTo = (query: string, state: unknown = null) => {
  const url = new URL(start);
  new URLSearchParams(query).forEach((value, name) => url.searchParams.set(name, value));
  window.history.replaceState(state, "", url);
};
const postParam = () => new URLSearchParams(window.location.search).get("post");

/**
 * Portal.BE answering the post alone with `single`, and the feed with posts 3, 2 and 1. `comments` answers what is asked
 * of a post's comments (none to read, by default).
 */
function serve(
  single: (id: number) => Response | Promise<Response>,
  comments: (request: Request) => Response | Promise<Response> = () => Response.json({ items: [], nextCursor: null }),
) {
  vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const { pathname: full } = new URL(request.url, window.location.href);
    const pathname = full.slice(full.indexOf("/api/")); // under whatever prefix the app calls Portal.BE by
    if (request.method === "DELETE") return Response.json({ tombstoned: false, removedParentId: null });
    if (pathname.endsWith("/pinned")) return Response.json([]);
    if (pathname.endsWith("/comments")) return comments(request);
    if (pathname === "/api/Posts") return Response.json({ items: [post(3), post(2), post(1)], nextCursor: null });
    const alone = /^\/api\/Posts\/(\d+)$/.exec(pathname);
    return alone ? single(Number(alone[1])) : new Response(null, { status: 404 });
  });
}

async function renderPopup(ui = <CommentsDialog />) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(
    portalApi.util.upsertQueryData("getCurrentUser", undefined, { user: { id: 1, fullName: "Nguyễn Văn An" } as UserDto, permissions: [] }),
  );
  return render(
    <Provider store={store}>
      <Toast.Provider />
      {ui}
    </Provider>,
  );
}

/** Where a part of the open popup is: the post, the comments or the composer. */
const paneBox = (name: "post" | "list" | "composer") =>
  page.getByRole("dialog").element().querySelector<HTMLElement>(`.comments-${name}`)!.getBoundingClientRect();

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  vi.restoreAllMocks();
  toast.clear();
  localStorage.clear();
  window.history.replaceState(null, "", start);
  await page.viewport(1000, 800);
});

test("shows the post of the address, with its author in the title", async () => {
  serve((id) => Response.json(post(id)));
  goTo("post=2");
  await renderPopup();

  const dialog = page.getByRole("dialog", { name: "Bài viết của Nguyễn Văn An" });
  await expect.element(dialog).toBeVisible();
  await expect.element(dialog.getByText("Bài số 2")).toBeVisible();
});

test("is closed without a post in the address", async () => {
  serve((id) => Response.json(post(id)));
  await renderPopup();
  expect(page.getByRole("dialog").query()).toBeNull();
});

test("opens from the card's button with the card's copy of the post, and Esc goes back to the feed", async () => {
  // The post alone never arrives: what the dialog shows is the feed's copy.
  serve(() => new Promise<Response>(() => {}));
  await renderPopup(<Feed />);
  await expect.element(page.getByText("Bài số 2")).toBeVisible();

  await page.getByRole("button", { name: "Bình luận" }).nth(1).click();

  expect(postParam()).toBe("2");
  await expect.element(page.getByRole("dialog").getByText("Bài số 2")).toBeVisible();

  await userEvent.keyboard("{Escape}");
  await vi.waitUntil(() => postParam() === null);
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
});

test("closes a landed link without leaving the page", async () => {
  serve((id) => Response.json(post(id)));
  // A page that Next loaded: its entry carries Next's own state.
  goTo("post=2&comment=7", { __NA: true });
  const before = window.history.length;
  await renderPopup();

  await page.getByRole("button", { name: "Đóng" }).click();

  await vi.waitUntil(() => postParam() === null);
  expect(new URLSearchParams(window.location.search).has("comment")).toBe(false);
  expect(window.history.length).toBe(before);
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
});

test("says the post is gone and closes when there is none", async () => {
  serve(() => Response.json({ status: 404, code: "not_found" }, { status: 404 }));
  goTo("post=99");
  await renderPopup();

  await expect.element(page.getByText("Bài viết không còn tồn tại")).toBeVisible();
  await vi.waitUntil(() => postParam() === null);
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
});

test("offers a retry when the post cannot be read for another reason", async () => {
  serve(() => new Response(null, { status: 500 }));
  goTo("post=2");
  await renderPopup();

  await expect.element(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  expect(postParam()).toBe("2");
});

test("has no ⋯ menu for a reader who can do nothing to the post", async () => {
  serve((id) => Response.json(post(id)));
  goTo("post=2");
  await renderPopup();

  await expect.element(page.getByRole("dialog").getByText("Bài số 2")).toBeVisible();
  expect(page.getByRole("button", { name: "Tuỳ chọn bài viết" }).query()).toBeNull();
});

test("edits the post from its ⋯ menu, and Esc in the editor leaves the popup open", async () => {
  serve((id) => Response.json({ ...post(id), canEdit: true }));
  goTo("post=2");
  await renderPopup();

  await page.getByRole("button", { name: "Tuỳ chọn bài viết" }).click();
  await page.getByRole("menuitem", { name: "Sửa" }).click();
  await expect.element(page.getByRole("dialog", { name: "Sửa bài viết" })).toBeVisible();

  await userEvent.keyboard("{Escape}");

  await expect.element(page.getByRole("dialog", { name: "Sửa bài viết" })).toBeVisible();
  expect(postParam()).toBe("2");
});

test("deletes the post from its ⋯ menu and closes, without saying the post is gone", async () => {
  let deleted = false;
  serve((id) => (deleted ? Response.json({ status: 404, code: "not_found" }, { status: 404 }) : Response.json({ ...post(id), canDelete: true })));
  goTo("post=2");
  await renderPopup();

  await page.getByRole("button", { name: "Tuỳ chọn bài viết" }).click();
  await page.getByRole("menuitem", { name: "Xoá" }).click();
  deleted = true;
  await page.getByRole("alertdialog").getByRole("button", { name: "Xoá" }).click();

  await vi.waitUntil(() => postParam() === null);
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  await new Promise((resolve) => setTimeout(resolve, 200)); // the 404 of the read that follows has come
  expect(page.getByText("Bài viết không còn tồn tại").query()).toBeNull();
});

test("hides the view button below 1024px", async () => {
  serve((id) => Response.json(post(id)));
  goTo("post=2");
  await renderPopup();
  const toggle = page.getByRole("button", { name: "Xem hai cột" });

  await expect.element(toggle).toBeVisible();
  await page.viewport(375, 800);
  await expect.element(page.getByLabelText("Xem hai cột")).not.toBeVisible(); // there, but not shown
});

test("shows the post and the comments side by side in two columns, and remembers it", async () => {
  serve((id) => Response.json(post(id)));
  goTo("post=2");
  await renderPopup();
  await expect.element(page.getByRole("dialog").getByText("Bài số 2")).toBeVisible();
  expect(paneBox("composer").top).toBeGreaterThan(paneBox("post").top);
  expect(paneBox("composer").left).toBeLessThan(paneBox("post").right);

  await page.getByRole("button", { name: "Xem hai cột" }).click();

  expect(page.getByRole("dialog").element().getAttribute("data-layout")).toBe("two");
  expect(paneBox("composer").left).toBeGreaterThanOrEqual(paneBox("post").right - 1);
  expect(paneBox("list").left).toBeGreaterThanOrEqual(paneBox("post").right - 1);
  expect(localStorage.getItem("portal.comments.layout")).toBe("two");
  await expect.element(page.getByRole("button", { name: "Xem một cột" })).toBeVisible();
});

test("is one column on a narrow screen however it was left", async () => {
  localStorage.setItem("portal.comments.layout", "two");
  await page.viewport(900, 800);
  serve((id) => Response.json(post(id)));
  goTo("post=2");
  await renderPopup();
  await expect.element(page.getByRole("dialog").getByText("Bài số 2")).toBeVisible();

  expect(paneBox("composer").left).toBeLessThan(paneBox("post").right);
});

test("is full screen on a phone", async () => {
  await page.viewport(375, 700);
  serve((id) => Response.json(post(id)));
  goTo("post=2");
  await renderPopup();

  const dialog = page.getByRole("dialog");
  await expect.element(dialog.getByText("Bài số 2")).toBeVisible();
  await vi.waitFor(() => {
    const box = dialog.element().getBoundingClientRect();
    expect([box.left, box.top, box.width, box.height]).toEqual([0, 0, window.innerWidth, window.innerHeight]);
  });
});

test("puts the cursor in the comment box when it opens", async () => {
  serve((id) => Response.json(post(id)));
  goTo("post=2");
  await renderPopup();

  await expect.element(page.getByRole("textbox")).toHaveFocus();
});

test("answers a comment from its Trả lời button, and scrolls to the reply sent", async () => {
  const root = makeComment(5, { postId: 2 });
  serve(
    (id) => Response.json(post(id)),
    (request) =>
      request.method === "POST"
        ? request.clone().json().then((body) => Response.json(makeComment(6, { postId: 2, parentId: 5, contentHtml: body.contentHtml })))
        : Response.json({ items: [root], nextCursor: null }),
  );
  goTo("post=2");
  await renderPopup();
  const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");

  await page.getByRole("button", { name: "Trả lời", exact: true }).click();
  await expect.element(page.getByText("Đang trả lời Trần Thị Bình")).toBeVisible();
  await userEvent.keyboard("Cảm ơn bạn{Enter}");

  await expect.element(page.getByRole("list").getByText("Cảm ơn bạn")).toBeVisible();
  await vi.waitFor(() => expect(scrolled.mock.contexts.some((row) => (row as HTMLElement).dataset?.commentId === "6")).toBe(true));
});

test("edits a comment from its menu", async () => {
  serve(
    (id) => Response.json(post(id)),
    () => Response.json({ items: [makeComment(5, { canEdit: true, contentHtml: "<p>Bản cũ</p>" })], nextCursor: null }),
  );
  goTo("post=2");
  await renderPopup();

  await page.getByRole("button", { name: "Tuỳ chọn bình luận" }).click();
  await page.getByRole("menuitem", { name: "Sửa" }).click();

  await expect.element(page.getByText("Đang sửa bình luận")).toBeVisible();
  await expect.element(page.getByRole("textbox")).toHaveFocus();
  expect(page.getByRole("textbox").element().textContent).toBe("Bản cũ");
});

/** Deletes the only comment there is, from its menu, and waits for its row to go. */
async function deleteTheComment() {
  await page.getByRole("button", { name: "Tuỳ chọn bình luận" }).click();
  await page.getByRole("menuitem", { name: "Xoá" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Xoá" }).click();
  await expect.element(page.getByText("Bình luận 5")).not.toBeInTheDocument();
  await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
}

test("puts the cursor back in the comment box after deleting a comment, so Esc still closes the popup", async () => {
  serve(
    (id) => Response.json(post(id)),
    () => Response.json({ items: [makeComment(5, { postId: 2, canDelete: true })], nextCursor: null }),
  );
  goTo("post=2");
  await renderPopup();

  await deleteTheComment();

  await expect.element(page.getByRole("textbox")).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  await vi.waitUntil(() => postParam() === null);
});

test("on a touch device deleting a comment opens no keyboard, and Esc still closes the popup", async () => {
  const matchMedia = window.matchMedia.bind(window);
  vi.spyOn(window, "matchMedia").mockImplementation((query) => {
    const result = matchMedia(query);
    if (query === "(pointer: coarse)") Object.defineProperty(result, "matches", { value: true });
    return result;
  });
  serve(
    (id) => Response.json(post(id)),
    () => Response.json({ items: [makeComment(5, { postId: 2, canDelete: true })], nextCursor: null }),
  );
  goTo("post=2");
  await renderPopup();

  await deleteTheComment();

  const textbox = page.getByRole("textbox").element();
  await vi.waitFor(() => expect(document.activeElement?.contains(textbox)).toBe(true));
  expect(document.activeElement).not.toBe(textbox);
  await userEvent.keyboard("{Escape}");
  await vi.waitUntil(() => postParam() === null);
});

test("with comments off, deleting a comment leaves the focus on the notice in their box, so Esc still closes the popup", async () => {
  serve(
    (id) => Response.json({ ...post(id), commentsDisabled: true }),
    () => Response.json({ items: [makeComment(5, { postId: 2, canDelete: true })], nextCursor: null }),
  );
  goTo("post=2");
  await renderPopup();
  await expect.element(page.getByText("Bình luận 5")).toBeVisible();

  await deleteTheComment();

  await expect.element(page.getByRole("status")).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  await vi.waitUntil(() => postParam() === null);
});

test("deleting the comment being edited ends the edit", async () => {
  serve(
    (id) => Response.json(post(id)),
    () => Response.json({ items: [makeComment(5, { postId: 2, canEdit: true, canDelete: true })], nextCursor: null }),
  );
  goTo("post=2");
  await renderPopup();

  await page.getByRole("button", { name: "Tuỳ chọn bình luận" }).click();
  await page.getByRole("menuitem", { name: "Sửa" }).click();
  await expect.element(page.getByText("Đang sửa bình luận")).toBeVisible();

  await deleteTheComment();

  await expect.element(page.getByText("Đang sửa bình luận")).not.toBeInTheDocument();
  expect(page.getByRole("textbox").element().textContent).toBe("");
});

test("deleting the comment being answered stops answering it", async () => {
  serve(
    (id) => Response.json(post(id)),
    () => Response.json({ items: [makeComment(5, { postId: 2, canDelete: true })], nextCursor: null }),
  );
  goTo("post=2");
  await renderPopup();

  await page.getByRole("button", { name: "Trả lời", exact: true }).click();
  await expect.element(page.getByText("Đang trả lời Trần Thị Bình")).toBeVisible();

  await deleteTheComment();

  await expect.element(page.getByText("Đang trả lời Trần Thị Bình")).not.toBeInTheDocument();
});

test("in two columns the post's text follows its author, and only the reactions stay at the foot", async () => {
  localStorage.setItem("portal.comments.layout", "two");
  serve((id) => Response.json(post(id)));
  goTo("post=2");
  await renderPopup();
  const dialog = page.getByRole("dialog");
  await expect.element(dialog.getByText("Bài số 2")).toBeVisible();

  await vi.waitFor(() => {
    const author = dialog.getByText("Nguyễn Văn An", { exact: true }).element().getBoundingClientRect();
    const text = dialog.getByText("Bài số 2").element().getBoundingClientRect();
    const reactions = dialog.getByRole("button", { name: "Bày tỏ cảm xúc" }).element().getBoundingClientRect();
    expect(text.top - author.bottom).toBeLessThan(50);
    expect(paneBox("post").bottom - reactions.bottom).toBeLessThan(40);
  });
});

test("in two columns a long post scrolls, and its pictures keep their height", async () => {
  localStorage.setItem("portal.comments.layout", "two");
  const picture = (id: string) => ({ id, kind: "Image", fileName: `${id}.png`, contentType: "image/png", size: 1, caption: null });
  serve((id) => Response.json({ ...post(id), contentHtml: "<p>Một đoạn dài</p>".repeat(100), media: [picture("a"), picture("b")] }));
  goTo("post=2");
  await renderPopup();
  const tile = page.getByRole("dialog").getByRole("button", { name: "ảnh 1/2" });
  await expect.element(tile).toBeInTheDocument();

  await vi.waitFor(() => {
    const pane = page.getByRole("dialog").element().querySelector<HTMLElement>(".comments-post")!;
    expect(pane.scrollHeight).toBeGreaterThan(pane.clientHeight);
    expect(tile.element().getBoundingClientRect().height).toBeGreaterThan(100);
  });
});

test("says the post is loading while it is", async () => {
  serve(() => new Promise<Response>(() => {}));
  goTo("post=2");
  await renderPopup();

  await expect.element(page.getByRole("status", { name: "Đang tải bài viết" })).toBeVisible();
});
