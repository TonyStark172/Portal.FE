import type { PostCommentDto, PostMediaDto } from "@/shared/api/generated/portalApi";

/** What was being written for a post when its comments popup closed. */
export type CommentDraft = {
  /** The text, as the editor's HTML; empty when there is none. */
  html: string;
  /** The image, video or file that finished uploading. */
  file: PostMediaDto | null;
  /** The comment being replied to. */
  replyTo: PostCommentDto | null;
};

const drafts = new Map<number, CommentDraft>();

/** The unsent comments, by post. Kept in memory only: they are gone when the page is loaded again. */
export const commentDrafts = {
  get: (postId: number) => drafts.get(postId),
  set: (postId: number, draft: CommentDraft) => void drafts.set(postId, draft),
  clear: (postId: number) => void drafts.delete(postId),
};
