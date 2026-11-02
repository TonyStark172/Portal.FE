import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { makeStore } from "@/core/store";
import type { PostDto } from "@/shared/api/generated/portalApi";
import { LocaleProvider } from "@/shared/i18n";
import { setStoredLocale } from "@/shared/i18n/locale";
import { hitsAround } from "@/shared/lib/hitArea.testing";
import { PostCard } from "./PostCard";

const HEADER_HEIGHT = 40;
const REACTIONS_HEIGHT = 45;

const commentButton = () => [...document.querySelectorAll("button")].find((b) => /bình luận|comment/i.test(b.textContent ?? ""))!;

const post = {
  id: 1,
  kind: "Normal" as PostDto["kind"],
  contentHtml: "<p>Nội dung</p>",
  author: { id: 1, fullName: "Nguyễn Văn An", positionName: "Kỹ sư" } as PostDto["author"],
  createdAt: "2026-10-01T08:00:00Z",
  media: [],
  attachments: [],
  mentions: [],
  mentionsEveryone: false,
  reactions: [
    { kind: "Like", count: 9000 },
    { kind: "Love", count: 1000 },
  ],
  myReaction: null,
  isPinned: false,
  canPin: false,
  canEdit: true,
  canDelete: true,
  commentCount: 0,
  commentsDisabled: false,
  canToggleComments: false,
  version: 1,
} as PostDto;

async function renderPost(over: Partial<PostDto> = {}, onOpenComments = () => {}) {
  const shown = { ...post, ...over };
  await render(
    <Provider store={makeStore()}>
      <PostCard post={shown} onEdit={() => {}} onOpenComments={onOpenComments} />
    </Provider>,
  );
  return shown;
}

beforeEach(async () => {
  await page.viewport(390, 844);
});

afterEach(async () => {
  await page.viewport(1000, 800);
});

describe("a post on a phone", () => {
  test("its small controls take a tap of at least 40px, though they look the same size", async () => {
    await renderPost();
    const options = document.querySelector('[aria-label="Tuỳ chọn bài viết"]')!;
    const react = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Bày tỏ cảm xúc"))!;
    const comment = commentButton();
    const timestamp = document.querySelector("time")!.parentElement!;
    const summary = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("xem ai đã bày tỏ cảm xúc"))!;

    for (const [name, control] of Object.entries({ options, react, comment, timestamp, summary })) {
      expect(hitsAround(control, 18), name).toBe(true);
    }
  });

  test("the header and the reactions line keep their height", async () => {
    await renderPost();
    const header = document.querySelector('[data-slot="card"] > div')!;
    const reactionsLine = document.querySelector('[data-slot="card"] > div:last-child')!;

    expect(Math.round(header.getBoundingClientRect().height)).toBe(HEADER_HEIGHT);
    expect(Math.round(reactionsLine.getBoundingClientRect().height)).toBe(REACTIONS_HEIGHT);
  });
});

describe("the comment button", () => {
  test.each([
    [{ commentCount: 1 }, "1 bình luận"],
    [{ commentCount: 3 }, "3 bình luận"],
    [{ commentCount: 0 }, "Bình luận"],
    [{ commentCount: 0, commentsDisabled: true }, "Đã tắt bình luận"],
    [{ commentCount: 3, commentsDisabled: true }, "3 bình luận"],
  ])("for %o it reads %s", async (over, text) => {
    await renderPost(over);

    expect(commentButton().textContent).toBe(text);
  });

  test.each([
    [1, "1 comment"],
    [2, "2 comments"],
  ])("in English, %i comment(s) read %s", async (commentCount, text) => {
    setStoredLocale("en-US");
    try {
      await render(
        <Provider store={makeStore()}>
          <LocaleProvider>
            <PostCard post={{ ...post, commentCount }} onEdit={() => {}} onOpenComments={() => {}} />
          </LocaleProvider>
        </Provider>,
      );

      expect(commentButton().textContent).toBe(text);
    } finally {
      setStoredLocale("vi-VN");
    }
  });

  test("opens the comments with the post", async () => {
    const onOpenComments = vi.fn();
    const shown = await renderPost({ commentCount: 2 }, onOpenComments);

    commentButton().click();

    expect(onOpenComments).toHaveBeenCalledExactlyOnceWith(shown);
  });
});
