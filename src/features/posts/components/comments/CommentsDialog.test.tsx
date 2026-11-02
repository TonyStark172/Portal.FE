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
const goTo = (query: string) => {
  const url = new URL(start);
  new URLSearchParams(query).forEach((value, name) => url.searchParams.set(name, value));
  window.history.replaceState(null, "", url);
};
const postParam = () => new URLSearchParams(window.location.search).get("post");

/** Portal.BE answering the post alone with `single`, and the feed with posts 3, 2 and 1. */
function serve(single: (id: number) => Response | Promise<Response>) {
  vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    const { pathname: full } = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    const pathname = full.slice(full.indexOf("/api/")); // under whatever prefix the app calls Portal.BE by
    if (pathname.endsWith("/pinned")) return Response.json([]);
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
  goTo("post=2&comment=7");
  const before = window.history.length;
  await renderPopup();

  await page.getByRole("button", { name: "Đóng" }).click();

  await vi.waitUntil(() => postParam() === null);
  expect(new URLSearchParams(window.location.search).has("comment")).toBe(false);
  expect(window.history.length).toBe(before);
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
