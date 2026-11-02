import type {
  DeletedPostComment,
  PostCommentDto,
  PostCommentPage,
  ReactionSummaryDto,
} from "@/shared/api/generated/portalApi";

/** The loaded pages of a post's comments (the data of the getPostComments infinite query). */
export type CommentPages = { pages: PostCommentPage[]; pageParams: unknown[] };

// The functions below change `pages` in place: they run on an Immer draft inside updateQueryData.

/** The root comments of every page, in order. A root listed on two pages (see addComment) is listed once. */
export function rootsOf(pages: CommentPages): PostCommentDto[] {
  const seen = new Set<number>();
  return pages.pages
    .flatMap((page) => page.items)
    .filter((root) => !seen.has(root.id) && seen.add(root.id));
}

/** Every loaded copy of comment `id`, root or reply. */
const copiesOf = (pages: CommentPages, id: number) =>
  pages.pages
    .flatMap((page) => page.items)
    .flatMap((root) => [root, ...root.replies])
    .filter((comment) => comment.id === id);

/**
 * A reply goes at the end of its root's replies. A root goes on the last loaded page, which may not be the last
 * page there is: it is listed twice when the pages after it arrive, which is why rootsOf drops the second copy.
 */
export function addComment(pages: CommentPages, comment: PostCommentDto) {
  if (comment.parentId == null) {
    pages.pages.at(-1)?.items.push(comment);
    return;
  }
  for (const root of copiesOf(pages, comment.parentId)) {
    if (root.replies.some((reply) => reply.id === comment.id)) continue;
    root.replies.push(comment);
    root.replyCount += 1;
  }
}

/** Replaces the loaded copy of `comment`. A root keeps the replies it has loaded and their count. */
export function replaceComment(pages: CommentPages, comment: PostCommentDto) {
  for (const page of pages.pages) {
    page.items = page.items.map((root) =>
      root.id === comment.id ? { ...comment, replies: root.replies, replyCount: root.replyCount } : root,
    );
    for (const root of page.items) {
      root.replies = root.replies.map((reply) => (reply.id === comment.id ? comment : reply));
    }
  }
}

/** What Portal.BE left of the comment deleted: a tombstone, or nothing, and with a reply the tombstone before it. */
export function removeComment(pages: CommentPages, id: number, deleted: DeletedPostComment) {
  if (deleted.tombstoned) {
    for (const comment of copiesOf(pages, id)) {
      comment.isDeleted = true;
      comment.contentHtml = "";
      comment.author = null;
      comment.file = null;
      comment.reactions = [];
      comment.myReaction = null;
      comment.canEdit = false;
      comment.canDelete = false;
    }
    return;
  }

  for (const page of pages.pages) {
    page.items = page.items.filter((root) => root.id !== id && root.id !== deleted.removedParentId);
    for (const root of page.items) {
      if (!root.replies.some((reply) => reply.id === id)) continue;
      root.replies = root.replies.filter((reply) => reply.id !== id);
      root.replyCount -= 1;
    }
  }
}

/** Replaces the replies a root lists (the first few) with all of them. */
export function setReplies(pages: CommentPages, rootId: number, replies: PostCommentDto[]) {
  for (const root of copiesOf(pages, rootId)) root.replies = replies;
}

export function patchReactions(pages: CommentPages, id: number, summary: ReactionSummaryDto) {
  for (const comment of copiesOf(pages, id)) {
    comment.reactions = summary.reactions;
    comment.myReaction = summary.myReaction;
  }
}
