import { describe, expect, test } from "vitest";
import type { PostCommentDto, PostCommentPage } from "@/shared/api/generated/portalApi";
import {
  addComment,
  patchReactions,
  removeComment,
  replaceComment,
  rootsOf,
  setReplies,
  type CommentPages,
} from "./comments";

/** Comment `id`; a reply names its root in `parentId`. */
const comment = (id: number, parentId: number | null = null, extra: Partial<PostCommentDto> = {}): PostCommentDto => ({
  id,
  postId: 1,
  parentId,
  contentHtml: `<p>Bình luận ${id}</p>`,
  author: { id: 7, fullName: "Trần Thị Bình" } as PostCommentDto["author"],
  isPostAuthor: false,
  createdAt: new Date(Date.UTC(2026, 10, 1) + id * 60_000).toISOString(),
  editedAt: null,
  isDeleted: false,
  file: null,
  reactions: [{ kind: "Like", count: 2 }],
  myReaction: "Like",
  replyCount: 0,
  replies: [],
  canEdit: true,
  canDelete: true,
  ...extra,
});

/** A root with `replyCount` replies of which the first `loaded` are listed. */
const thread = (id: number, replyCount: number, loaded = replyCount): PostCommentDto =>
  comment(id, null, {
    replyCount,
    replies: Array.from({ length: loaded }, (_, i) => comment(id * 10 + i + 1, id)),
  });

const pagesOf = (...pages: PostCommentPage[]): CommentPages => ({ pages, pageParams: pages.map(() => null) });
const page = (items: PostCommentDto[], nextCursor: string | null = null): PostCommentPage => ({ items, nextCursor });

const rootOf = (pages: CommentPages, id: number) => rootsOf(pages).find((c) => c.id === id)!;

describe("rootsOf", () => {
  test("lists the roots of every page in order, the first copy of a repeated root only", () => {
    const first = comment(1, null, { contentHtml: "<p>first</p>" });
    const pages = pagesOf(page([first, comment(2)], "x"), page([comment(1, null, { contentHtml: "<p>again</p>" }), comment(3)]));

    expect(rootsOf(pages).map((c) => c.id)).toEqual([1, 2, 3]);
    expect(rootsOf(pages)[0]).toBe(first);
  });
});

describe("addComment", () => {
  test("a new root is listed once when its page arrives later", () => {
    const pages = pagesOf(page([comment(1), comment(2)], "x"));

    addComment(pages, comment(99));
    expect(pages.pages[0].items.at(-1)?.id).toBe(99);

    pages.pages.push(page([comment(3), comment(99)]));
    expect(rootsOf(pages).filter((c) => c.id === 99)).toHaveLength(1);
  });

  test("a reply goes under its root and raises the count", () => {
    const pages = pagesOf(page([comment(1), thread(2, 2)]));

    addComment(pages, comment(50, 2));

    const root = rootOf(pages, 2);
    expect(root.replies.at(-1)?.id).toBe(50);
    expect(root.replyCount).toBe(3);
    expect(rootOf(pages, 1).replyCount).toBe(0);
  });

  test("a reply whose root is not loaded changes nothing", () => {
    const pages = pagesOf(page([comment(1)]));

    addComment(pages, comment(50, 2));

    expect(pages).toEqual(pagesOf(page([comment(1)])));
  });
});

describe("replaceComment", () => {
  test("replacing a root keeps its loaded replies", () => {
    const pages = pagesOf(page([thread(2, 4, 2)]));

    replaceComment(pages, comment(2, null, { contentHtml: "<p>sửa</p>", editedAt: "2026-11-02T00:00:00Z" }));

    const root = rootOf(pages, 2);
    expect(root.contentHtml).toBe("<p>sửa</p>");
    expect(root.replies).toHaveLength(2);
    expect(root.replyCount).toBe(4);
  });

  test("replacing a reply changes it in place", () => {
    const pages = pagesOf(page([thread(2, 3)]));

    replaceComment(pages, comment(21, 2, { contentHtml: "<p>sửa</p>" }));

    expect(rootOf(pages, 2).replies.map((r) => r.contentHtml)).toEqual(["<p>sửa</p>", "<p>Bình luận 22</p>", "<p>Bình luận 23</p>"]);
  });
});

describe("removeComment", () => {
  test("a tombstoned delete blanks the root and keeps its replies", () => {
    const pages = pagesOf(page([thread(2, 2)]));

    removeComment(pages, 2, { tombstoned: true, removedParentId: null });

    const root = rootOf(pages, 2);
    expect(root).toMatchObject({
      isDeleted: true,
      contentHtml: "",
      author: null,
      file: null,
      reactions: [],
      myReaction: null,
      canEdit: false,
      canDelete: false,
      replyCount: 2,
    });
    expect(root.replies).toHaveLength(2);
  });

  test("a root without replies goes entirely", () => {
    const pages = pagesOf(page([comment(1), comment(2)]));

    removeComment(pages, 2, { tombstoned: false, removedParentId: null });

    expect(rootsOf(pages).map((c) => c.id)).toEqual([1]);
  });

  test("deleting a reply lowers the count", () => {
    const pages = pagesOf(page([thread(2, 3)]));

    removeComment(pages, 22, { tombstoned: false, removedParentId: null });

    const root = rootOf(pages, 2);
    expect(root.replies.map((r) => r.id)).toEqual([21, 23]);
    expect(root.replyCount).toBe(2);
  });

  test("deleting a reply removes its tombstone parent when told to", () => {
    const pages = pagesOf(page([comment(1), thread(2, 1)]));
    removeComment(pages, 2, { tombstoned: true, removedParentId: null });

    removeComment(pages, 21, { tombstoned: false, removedParentId: 2 });

    expect(rootsOf(pages).map((c) => c.id)).toEqual([1]);
  });
});

describe("setReplies", () => {
  test("replaces the preview with the full thread", () => {
    const pages = pagesOf(page([thread(2, 5, 2)]));
    const full = Array.from({ length: 5 }, (_, i) => comment(20 + i + 1, 2));

    setReplies(pages, 2, full);

    const root = rootOf(pages, 2);
    expect(root.replies.map((r) => r.id)).toEqual([21, 22, 23, 24, 25]);
    expect(root.replyCount).toBe(5);
  });
});

describe("patchReactions", () => {
  test("writes the counts of a root and of a reply", () => {
    const pages = pagesOf(page([thread(2, 1)]));
    const summary = { reactions: [{ kind: "Love" as const, count: 1 }], myReaction: "Love" as const };

    patchReactions(pages, 2, summary);
    patchReactions(pages, 21, { reactions: [], myReaction: null });

    const root = rootOf(pages, 2);
    expect(root).toMatchObject(summary);
    expect(root.replies[0]).toMatchObject({ reactions: [], myReaction: null });
  });
});
