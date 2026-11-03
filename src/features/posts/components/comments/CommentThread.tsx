"use client";

import { memo } from "react";
import { Button, toast } from "@heroui/react";
import { portalApi, type PostCommentDto, type PostDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { CommentRow } from "./CommentRow";
import { CommentSkeleton } from "./CommentSkeleton";

type CommentThreadProps = {
  post: PostDto;
  root: PostCommentDto;
  /** The comment to mark (CommentList's, for a moment after a link opened it). */
  highlightedId: number | null;
  onReply: (target: PostCommentDto) => void;
  onEdit: (comment: PostCommentDto) => void;
  onDeleted: (id: number) => void;
};

/**
 * A root comment with the replies Portal.BE sent (the first few, or all of them) under it, and "Xem thêm N trả lời"
 * for those it did not. N counts what is not loaded: a reply just written joins the loaded ones and the count.
 *
 * Memoized: loading another page keeps the cached comments already shown as they were, so only the new threads are
 * drawn, instead of every thread again (which made each page slower than the last on a post with thousands).
 */
export const CommentThread = memo(function CommentThread({ post, root, highlightedId, onReply, onEdit, onDeleted }: CommentThreadProps) {
  const { t } = useLocale();
  const [loadReplies, { isFetching }] = portalApi.endpoints.getPostCommentReplies.useLazyQuery();
  const hidden = root.replyCount - root.replies.length;
  const hasReplies = root.replies.length > 0 || hidden > 0;

  // The replies go into the comments in the cache (see getPostCommentReplies in api.ts), which is what shows them.
  // Always asked for again: an answer kept from before would not be written there a second time.
  async function showAll() {
    try {
      await loadReplies({ id: root.id }, false).unwrap();
    } catch (error) {
      toast.danger(toApiProblem(error).detail ?? t("posts.comments.loadError"));
    }
  }

  return (
    <li className="flex flex-col">
      <CommentRow
        post={post}
        comment={root}
        onReply={onReply}
        onEdit={onEdit}
        onDeleted={onDeleted}
        isHighlighted={highlightedId === root.id}
        hasReplies={hasReplies}
      />
      {hasReplies && (
        <div className="comment-replies">
          {root.replies.map((reply) => (
            <div key={reply.id} className="comment-reply">
              <CommentRow post={post} comment={reply} onReply={onReply} onEdit={onEdit} onDeleted={onDeleted} isHighlighted={highlightedId === reply.id} />
            </div>
          ))}
          {hidden > 0 && (
            <div className="comment-reply">
              {/* While they load, rows like replies (up to two) stand in place of the button. */}
              {isFetching ? (
                <CommentSkeleton count={Math.min(hidden, 2)} label={t("posts.comments.loadingReplies")} className="py-1" />
              ) : (
                <Button size="sm" variant="ghost" className="tap-target text-xs text-muted" onPress={() => void showAll()}>
                  {hidden === 1 ? t("posts.comments.moreRepliesOne") : t("posts.comments.moreReplies").replace("{count}", String(hidden))}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
});
