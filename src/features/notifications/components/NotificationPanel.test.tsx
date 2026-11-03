import "@/app/globals.css";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { Toast, toast } from "@heroui/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { useCommentsUrl } from "@/features/posts/hooks/useCommentsUrl";
import type { NotificationDto, NotificationPage } from "@/shared/api/generated/portalApi";
import { signedIn } from "@/shared/session/sessionSlice";
import { tokenExpiringIn } from "@/shared/session/token.testing";
import { fakeHub } from "../hooks/fakeHub.testing";
import { NotificationBell } from "./NotificationBell";

vi.mock("@microsoft/signalr", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@microsoft/signalr")>()),
  HubConnectionBuilder: (await import("../hooks/fakeHub.testing")).FakeHubConnectionBuilder,
}));

/** The router pushes to the address of the page, as Next's does for the same site; the pages then follow it. */
const navigation = vi.hoisted(() => ({ pushes: [] as string[] }));
vi.mock("next/navigation", async () => {
  const { historyNavigation } = await import("@/features/posts/hooks/navigation.testing");
  return {
    ...historyNavigation,
    useRouter: () => ({
      push: (href: string) => {
        navigation.pushes.push(href);
        window.history.pushState(null, "", href);
      },
    }),
  };
});

/** A notification; the higher the id the newer it is (a tenth of a second apart, so all are from today unless a test says otherwise). */
const row = (id: number, changes: Partial<NotificationDto> = {}): NotificationDto => ({
  id,
  kind: "PostComment",
  actor: { id: 7, fullName: "Lê Hà", avatarUrl: null },
  actorCount: 1,
  postId: 10,
  commentId: null,
  meetingId: null,
  excerpt: `Bình luận số ${id}`,
  meetingStartUtc: null,
  occurredAt: new Date(Date.now() - (100 - id) * 100).toISOString(),
  isRead: false,
  ...changes,
});
const rowsUpTo = (last: number) => Array.from({ length: last }, (_, i) => row(last - i));

/** What Portal.BE says now. `respond` answers a list request in place of the default paging by offset. */
const server = {
  rows: [] as NotificationDto[],
  lists: [] as URL[],
  readAll: 0,
  readAllStatus: 204,
  reads: [] as number[],
  readStatus: 204,
  countStatus: 200,
  failing: 0,
  hold: null as Promise<void> | null,
  respond: null as null | ((cursor: string | null, unreadOnly: boolean) => NotificationPage),
};

function pageOf(cursor: string | null, unreadOnly: boolean): NotificationPage {
  const rows = server.rows.filter((item) => !unreadOnly || !item.isRead);
  const offset = cursor ? Number(cursor) : 0;
  return { items: rows.slice(offset, offset + 20), nextCursor: offset + 20 < rows.length ? String(offset + 20) : null };
}

function stubApi() {
  vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input instanceof Request ? input.url : input), window.location.href);
    if (url.pathname.endsWith("/unread-count")) {
      if (server.countStatus !== 200) return new Response(null, { status: server.countStatus });
      return Response.json(server.rows.filter((item) => !item.isRead).length);
    }
    const read = /\/Notifications\/(\d+)\/read$/.exec(url.pathname);
    if (read) {
      server.reads.push(Number(read[1]));
      if (server.readStatus !== 204) return new Response(null, { status: server.readStatus });
      server.rows = server.rows.map((item) => (item.id === Number(read[1]) ? { ...item, isRead: true } : item));
      return new Response(null, { status: 204 });
    }
    if (url.pathname.endsWith("/read-all")) {
      server.readAll++;
      if (server.readAllStatus !== 204) return new Response(null, { status: server.readAllStatus });
      server.rows = server.rows.map((item) => ({ ...item, isRead: true }));
      return new Response(null, { status: 204 });
    }
    if (url.pathname.endsWith("/api/Notifications")) {
      server.lists.push(url);
      await server.hold;
      if (server.failing > 0) {
        server.failing--;
        return new Response(null, { status: 500 });
      }
      const cursor = url.searchParams.get("cursor");
      const unreadOnly = url.searchParams.get("unreadOnly") === "true";
      return Response.json((server.respond ?? pageOf)(cursor, unreadOnly));
    }
    return new Response(null, { status: 404 });
  });
}

/** Signs in, shows the bell and opens its panel over `rows`. */
async function openPanel(rows: NotificationDto[], beside?: ReactNode) {
  server.rows = rows;
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: tokenExpiringIn(1800), accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  const screen = await render(
    <Provider store={store}>
      <Toast.Provider />
      {beside}
      <NotificationBell />
    </Provider>,
  );
  await screen.getByRole("button", { name: /^Thông báo/ }).click();
  const dialog = screen.getByRole("dialog", { name: "Thông báo" });
  await expect.element(dialog).toBeVisible();
  // It grows into place: measure it when it has (the skeletons' pulse never ends, and is not waited for).
  const growing = document.getAnimations().filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime));
  await Promise.all(growing.map((animation) => animation.finished));
  return { ...screen, store, dialog };
}

const rowElements = () => [...document.querySelectorAll<HTMLElement>("[role=dialog] li")];
const excerptOf = (item: Element) => item.querySelector(".truncate")?.textContent;
const excerpts = () => rowElements().map(excerptOf);
const unreadExcerpts = () => rowElements().filter((item) => item.hasAttribute("data-unread")).map(excerptOf);
/** The placeholder rows on screen, each made of grey blocks. */
const skeletonRows = () => [...document.querySelectorAll("[role=dialog] [role=status] > div")].filter((item) => item.querySelector(".skeleton"));
const waitForRows = (count: number) => vi.waitUntil(() => rowElements().length === count);
/** The list is the one part of the panel that scrolls. */
const scroller = () => document.querySelector<HTMLElement>("[data-slot=notification-list]")!;
const scrollToEnd = () => void (scroller().scrollTop = scroller().scrollHeight);

beforeEach(() => {
  fakeHub.reset();
  navigation.pushes = [];
  Object.assign(server, { rows: [], lists: [], readAll: 0, readAllStatus: 204, reads: [], readStatus: 204, countStatus: 200, failing: 0, hold: null, respond: null });
  stubApi();
});
const start = window.location.href;
afterEach(async () => {
  window.history.replaceState(null, "", start);
  toast.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  await page.viewport(1000, 800);
});

describe("loading", () => {
  test("shows skeleton rows on the first load and when loading more, no spinner", async () => {
    let release = () => {};
    server.hold = new Promise<void>((resolve) => (release = resolve));
    const { dialog } = await openPanel(rowsUpTo(45));

    await expect.element(dialog.getByRole("status", { name: "Đang tải" })).toBeVisible();
    expect(skeletonRows()).toHaveLength(5);
    expect(document.querySelector("[role=progressbar]")).toBeNull();
    release();
    server.hold = null;
    await waitForRows(20);
    await expect.element(dialog.getByRole("status", { name: "Đang tải" })).not.toBeInTheDocument();

    server.hold = new Promise<void>((resolve) => (release = resolve));
    scrollToEnd();
    await expect.element(dialog.getByRole("status", { name: "Đang tải" })).toBeVisible();
    expect(skeletonRows()).toHaveLength(2);
    expect(document.querySelector("[role=progressbar]")).toBeNull();
    expect(rowElements()).toHaveLength(20);
    release();
    await waitForRows(40);
  });

  test("loads the next 20 at the end and stops when there are no more", async () => {
    await openPanel(rowsUpTo(45));
    await waitForRows(20);
    expect(server.lists).toHaveLength(1);
    expect(server.lists[0].searchParams.get("pageSize")).toBe("20");
    expect(server.lists[0].searchParams.has("cursor")).toBe(false);

    scrollToEnd();
    await waitForRows(40);
    expect(server.lists[1].searchParams.get("cursor")).toBe("20");

    scrollToEnd();
    await waitForRows(45);
    expect(server.lists[2].searchParams.get("cursor")).toBe("40");

    scrollToEnd();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(server.lists).toHaveLength(3);
    expect(rowElements()).toHaveLength(45);
  });

  test("a row that moved to the top meanwhile is listed once", async () => {
    const page2 = [row(9), row(3)];
    server.respond = (cursor) => (cursor ? { items: page2, nextCursor: null } : { items: [row(5), row(4)], nextCursor: "next" });
    await openPanel([]);
    await waitForRows(4);
    expect(excerpts()).toEqual(["Bình luận số 5", "Bình luận số 4", "Bình luận số 9", "Bình luận số 3"]);

    // #9 was bumped while the pages were being read again: the first now starts with it, and the second, read before
    // the bump, still has it. Cursors are chained from the fresh previous page, so this only happens in that race.
    server.respond = (cursor) => (cursor ? { items: page2, nextCursor: null } : { items: [row(9), row(5), row(4)], nextCursor: "next" });
    fakeHub.last.signal("Added");

    await vi.waitUntil(() => excerpts()[0] === "Bình luận số 9");
    expect(excerpts()).toEqual(["Bình luận số 9", "Bình luận số 5", "Bình luận số 4", "Bình luận số 3"]);
  });

  test("shows the empty lines for each tab", async () => {
    const { dialog } = await openPanel([]);
    await expect.element(dialog.getByText("Chưa có thông báo nào")).toBeVisible();

    await dialog.getByRole("tab", { name: "Chưa đọc" }).click();

    await expect.element(dialog.getByText("Không có thông báo chưa đọc")).toBeVisible();
  });

  test("shows the error with Thử lại, which retries", async () => {
    server.failing = 1;
    const { dialog } = await openPanel(rowsUpTo(2));
    await expect.element(dialog.getByText("Không tải được thông báo")).toBeVisible();

    await dialog.getByRole("button", { name: "Thử lại" }).click();

    await waitForRows(2);
    await expect.element(dialog.getByText("Không tải được thông báo")).not.toBeInTheDocument();
  });
});

describe("the list", () => {
  test("groups Hôm nay and Trước đó, newest first", async () => {
    const lastWeek = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    await openPanel([row(3), row(2), row(1, { occurredAt: lastWeek })]);
    await waitForRows(3);

    const shape = [...document.querySelectorAll("[role=dialog] h3, [role=dialog] li")].map((el) =>
      el.tagName === "H3" ? el.textContent : excerptOf(el),
    );

    expect(shape).toEqual(["Hôm nay", "Bình luận số 3", "Bình luận số 2", "Trước đó", "Bình luận số 1"]);
  });

  test("marks unread rows with a tint and a dot", async () => {
    await openPanel([row(2), row(1, { isRead: true })]);
    await waitForRows(2);
    const [unread, read] = rowElements();

    expect(unread.hasAttribute("data-unread")).toBe(true);
    expect(read.hasAttribute("data-unread")).toBe(false);
    expect(getComputedStyle(read).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(unread).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(unread.querySelector("span.rounded-full")?.getBoundingClientRect().width).toBe(10);
    expect(read.querySelector("span.rounded-full")).toBeNull();
    expect(unread.querySelector(".sr-only")?.textContent).toBe("Chưa đọc");
  });

  test("shows the title and the start in UTC+7 of a meeting, and a calendar when no one is named", async () => {
    await openPanel([
      row(1, { kind: "MeetingCanceled", actor: null, postId: null, meetingId: 4, excerpt: "Họp tuần", meetingStartUtc: "2026-11-12T02:00:00Z" }),
    ]);
    await waitForRows(1);
    const [item] = rowElements();

    expect(item.textContent).toContain("Cuộc họp đã bị huỷ");
    expect(excerptOf(item)).toBe("Họp tuần · 09:00 12/11/2026");
    expect(item.querySelector("svg")).not.toBeNull();
    expect(item.querySelector("[data-slot=avatar], img")).toBeNull();
  });

  test("the unread tab lists only unread rows and shows the count", async () => {
    const { dialog } = await openPanel([row(3), row(2, { isRead: true }), row(1)]);
    await waitForRows(3);
    const tab = dialog.getByRole("tab", { name: "Chưa đọc (2)" });
    await expect.element(tab).toBeVisible();

    await tab.click();

    await vi.waitUntil(() => rowElements().length === 2);
    expect(excerpts()).toEqual(["Bình luận số 3", "Bình luận số 1"]);
    expect(server.lists.at(-1)?.searchParams.get("unreadOnly")).toBe("true");
  });

  test("mark all read clears the dots and the count, without asking", async () => {
    const { dialog } = await openPanel([row(2), row(1)]);
    await waitForRows(2);
    await expect.element(dialog.getByRole("tab", { name: "Chưa đọc (2)" })).toBeVisible();

    await dialog.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }).click();

    await vi.waitUntil(() => unreadExcerpts().length === 0);
    await expect.element(dialog.getByRole("tab", { name: "Chưa đọc", exact: true })).toBeVisible();
    await expect.element(dialog.getByRole("button", { name: "Đánh dấu tất cả đã đọc" })).toBeDisabled();
    expect(server.readAll).toBe(1);
    expect(document.querySelector("[role=alertdialog]")).toBeNull();
    expect(rowElements()).toHaveLength(2);
  });
});

describe("when it goes wrong", () => {
  test("a mark all read that fails says so and leaves the dots", async () => {
    const { dialog } = await openPanel([row(2), row(1)]);
    await waitForRows(2);
    server.readAllStatus = 500;

    await dialog.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }).click();

    await vi.waitUntil(() => document.body.textContent?.includes("Đã có lỗi xảy ra. Vui lòng thử lại."));
    expect(server.readAll).toBe(1);
    expect(unreadExcerpts()).toEqual(["Bình luận số 2", "Bình luận số 1"]);
  });

  test("mark all read stays available while the count is still unknown but a row is unread", async () => {
    server.countStatus = 500;
    const { dialog } = await openPanel([row(2)]);
    await waitForRows(1);

    await expect.element(dialog.getByRole("button", { name: "Đánh dấu tất cả đã đọc" })).toBeEnabled();
  });
});

describe("staying current", () => {
  test("a new notification at the top appears", async () => {
    await openPanel(rowsUpTo(2));
    await waitForRows(2);

    server.rows = [row(3), ...server.rows];
    fakeHub.last.signal("Added");

    await vi.waitUntil(() => excerpts()[0] === "Bình luận số 3");
    expect(rowElements()).toHaveLength(3);
  });

  test("a broadcast waits to be read like the count does, so the company does not all read at once", async () => {
    await openPanel(rowsUpTo(2));
    await waitForRows(2);
    const requests = server.lists.length;
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    server.rows = [row(3), ...server.rows];

    fakeHub.last.signal("Added", true);
    await vi.advanceTimersByTimeAsync(9000);
    expect(server.lists).toHaveLength(requests);
    await vi.advanceTimersByTimeAsync(1000);

    await vi.waitUntil(() => excerpts()[0] === "Bình luận số 3");
    vi.useRealTimers();
  });

  test("a new notification while scrolled shows the button and leaves the list still", async () => {
    const { dialog } = await openPanel(rowsUpTo(45));
    await waitForRows(20);
    scroller().scrollTop = 300;
    await vi.waitUntil(() => scroller().scrollTop === 300);
    const requests = server.lists.length;

    server.rows = [row(99), ...server.rows];
    fakeHub.last.signal("Added");

    const button = dialog.getByRole("button", { name: "Có thông báo mới" });
    await expect.element(button).toBeVisible();
    expect(scroller().scrollTop).toBe(300);
    expect(server.lists).toHaveLength(requests);
    expect(excerpts()).not.toContain("Bình luận số 99");

    await button.click();

    await vi.waitUntil(() => scroller().scrollTop === 0);
    await vi.waitUntil(() => excerpts()[0] === "Bình luận số 99");
    await expect.element(button).not.toBeInTheDocument();
  });

  test("scrolling back to the top by hand brings in what the button offered", async () => {
    const { dialog } = await openPanel(rowsUpTo(45));
    await waitForRows(20);
    scroller().scrollTop = 300;
    await vi.waitUntil(() => scroller().scrollTop === 300);
    server.rows = [row(99), ...server.rows];
    fakeHub.last.signal("Updated");
    await expect.element(dialog.getByRole("button", { name: "Có thông báo mới" })).toBeVisible();

    scroller().scrollTop = 0;

    await vi.waitUntil(() => excerpts()[0] === "Bình luận số 99");
    await expect.element(dialog.getByRole("button", { name: "Có thông báo mới" })).not.toBeInTheDocument();
  });

  test("a row that was removed or read is re-read at once, wherever the list is scrolled", async () => {
    const { dialog } = await openPanel(rowsUpTo(45));
    await waitForRows(20);
    scroller().scrollTop = 300;
    await vi.waitUntil(() => scroller().scrollTop === 300);

    server.rows = server.rows.filter((item) => item.id !== 45).map((item) => (item.id === 44 ? { ...item, isRead: true } : item));
    fakeHub.last.signal("Removed");
    await vi.waitUntil(() => !excerpts().includes("Bình luận số 45"));
    server.rows = server.rows.map((item) => (item.id === 43 ? { ...item, isRead: true } : item));
    fakeHub.last.signal("Read");

    await vi.waitUntil(() => !unreadExcerpts().includes("Bình luận số 43"));
    expect(unreadExcerpts()).not.toContain("Bình luận số 44");
    // The browser keeps what is on screen where it is, so it moves by the removed row; it does not go back to the top.
    expect(scroller().scrollTop).toBeGreaterThan(100);
    await expect.element(dialog.getByRole("button", { name: "Có thông báo mới" })).not.toBeInTheDocument();
  });
});

describe("the popover", () => {
  test("opens under the bell, 420px wide and at most 70vh, and only the list scrolls", async () => {
    const { dialog } = await openPanel(rowsUpTo(45));
    await waitForRows(20);
    const tabs = dialog.getByRole("tablist").element().getBoundingClientRect();

    expect(dialog.element().getBoundingClientRect().width).toBe(420);
    expect(dialog.element().getBoundingClientRect().height).toBeLessThanOrEqual(window.innerHeight * 0.7);
    scroller().scrollTop = 200;

    await vi.waitUntil(() => scroller().scrollTop === 200);
    expect(dialog.getByRole("tablist").element().getBoundingClientRect().top).toBe(tabs.top);
    await expect.element(dialog.getByRole("heading", { name: "Thông báo" })).toBeInViewport();
    expect(getComputedStyle(dialog.element().querySelector("button[aria-label=Đóng]")!).display).toBe("none");
  });

  test("closes on Esc and on a click outside", async () => {
    const { dialog, ...screen } = await openPanel(rowsUpTo(2));
    await waitForRows(2);

    await userEvent.keyboard("{Escape}");
    await expect.element(dialog).not.toBeInTheDocument();

    await screen.getByRole("button", { name: /^Thông báo/ }).click();
    await expect.element(dialog).toBeVisible();
    // The page behind the popover is covered by a layer that takes the click.
    const outside = document.elementFromPoint(window.innerWidth - 5, window.innerHeight - 5) as HTMLElement;
    expect(outside.closest("[role=dialog]")).toBeNull();
    await userEvent.click(page.elementLocator(outside), { position: { x: 2, y: 2 } });

    await expect.element(dialog).not.toBeInTheDocument();
  });

  test("is full screen with a close button at 375px", async () => {
    await page.viewport(375, 800);
    const { dialog } = await openPanel(rowsUpTo(2));
    await waitForRows(2);

    const box = dialog.element().getBoundingClientRect();
    expect([box.left, box.top, box.width, box.height]).toEqual([0, 0, 375, 800]);
    const close = dialog.getByRole("button", { name: "Đóng" });
    await expect.element(close).toBeVisible();

    await close.click();

    await expect.element(dialog).not.toBeInTheDocument();
  });
});

/** What the comments popup of the page is on, from the address. */
function PopupProbe() {
  const { postId, commentId } = useCommentsUrl();
  return <output aria-label="popup">{`post ${postId} comment ${commentId}`}</output>;
}

describe("opening a notification", () => {
  const commentRow = (id: number, changes: Partial<NotificationDto> = {}) => row(id, { postId: 1, commentId: 2, ...changes });

  test("a click marks the row read, closes the panel and goes to its link", async () => {
    const { dialog } = await openPanel([commentRow(2), row(1)]);
    await waitForRows(2);

    await dialog.getByRole("button", { name: /Lê Hà đã bình luận vào bài của bạn.*Bình luận số 2/ }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(navigation.pushes).toEqual(["/?post=1&comment=2"]);
    expect(server.reads).toEqual([2]);
    expect(window.location.search).toBe("?post=1&comment=2");
  });

  test("a row already read goes to its link without reading it again", async () => {
    const { dialog } = await openPanel([row(2, { isRead: true, commentId: null })]);
    await waitForRows(1);

    await dialog.getByRole("button", { name: /Bình luận số 2/ }).click();

    expect(navigation.pushes).toEqual(["/?post=10"]);
    expect(server.reads).toEqual([]);
  });

  test("a row is reached by the keyboard and opened with Enter", async () => {
    const { dialog } = await openPanel([commentRow(2)]);
    await waitForRows(1);
    const button = dialog.getByRole("button", { name: /Bình luận số 2/ });

    button.element().focus();
    await expect.element(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await expect.element(dialog).not.toBeInTheDocument();
    expect(navigation.pushes).toEqual(["/?post=1&comment=2"]);
    expect(server.reads).toEqual([2]);
  });

  test("a read failure still goes to the link, and the row stays unread", async () => {
    server.readStatus = 500;
    const { dialog, ...screen } = await openPanel([commentRow(2)]);
    await waitForRows(1);

    await dialog.getByRole("button", { name: /Bình luận số 2/ }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(navigation.pushes).toEqual(["/?post=1&comment=2"]);
    expect(server.reads).toEqual([2]);
    await screen.getByRole("button", { name: /^Thông báo/ }).click();
    await vi.waitUntil(() => rowElements().length === 1);
    expect(unreadExcerpts()).toEqual(["Bình luận số 2"]);
  });

  test("opens from another page and from the same page", async () => {
    window.history.replaceState(null, "", "/meetings");
    const { dialog, ...screen } = await openPanel([commentRow(3), row(2, { postId: 2, commentId: null }), row(1, { postId: 1, commentId: null })], <PopupProbe />);
    await waitForRows(3);
    await expect.element(screen.getByLabelText("popup")).toHaveTextContent("post null comment null");

    await dialog.getByRole("button", { name: /Bình luận số 3/ }).click();

    expect(window.location.pathname).toBe("/");
    await expect.element(screen.getByLabelText("popup")).toHaveTextContent("post 1 comment 2");

    await screen.getByRole("button", { name: /^Thông báo/ }).click();
    await vi.waitUntil(() => rowElements().length === 3);
    await screen.getByRole("dialog", { name: "Thông báo" }).getByRole("button", { name: /Bình luận số 2/ }).click();

    await expect.element(screen.getByLabelText("popup")).toHaveTextContent("post 2 comment null");
    expect(navigation.pushes).toEqual(["/?post=1&comment=2", "/?post=2"]);
  });

  test("a meeting row goes to the calendar with its meeting", async () => {
    const { dialog } = await openPanel([row(1, { kind: "MeetingInvited", postId: null, meetingId: 7, excerpt: "Họp tuần", meetingStartUtc: "2026-11-12T02:00:00Z" })]);
    await waitForRows(1);

    await dialog.getByRole("button", { name: /Họp tuần/ }).click();

    expect(navigation.pushes).toEqual(["/meetings?meeting=7"]);
    expect(server.reads).toEqual([1]);
  });
});
