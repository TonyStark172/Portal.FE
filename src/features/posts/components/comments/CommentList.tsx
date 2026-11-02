"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Skeleton, toast } from "@heroui/react";
import type { PostCommentDto, PostDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { useGetCommentsInfiniteQuery } from "../../api";
import { rootsOf } from "../../lib/comments";
import { CommentThread } from "./CommentThread";

/** How long the comment a link points at stays marked. */
const HIGHLIGHT_MS = 2000;

type CommentListProps = {
  post: PostDto;
  /** The comment the address points at: its page is loaded, it is scrolled to and marked. */
  focusId?: number;
  onReply: (target: PostCommentDto) => void;
  onEdit: (comment: PostCommentDto) => void;
  onDeleted: () => void;
  /** The focused comment is gone: the message is shown, and the popup is to close. */
  onMissing: () => void;
};

/** The comments of a post: roots oldest first, a page at a time, each with its replies. */
export function CommentList({ post, focusId, onReply, onEdit, onDeleted, onMissing }: CommentListProps) {
  const { t } = useLocale();
  const { currentData, error, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage, isFetchNextPageError } =
    useGetCommentsInfiniteQuery({ postId: post.id, focus: focusId });
  const list = useRef<HTMLDivElement>(null);
  const [fadedId, setFadedId] = useState<number | null>(null);
  const roots = currentData ? rootsOf(currentData) : undefined;

  const isGone = focusId !== undefined && isError && !currentData && toApiProblem(error).status === 404;
  useEffect(() => {
    if (!isGone) return;
    toast.danger(t("posts.comments.gone"));
    onMissing();
  }, [isGone, onMissing, t]);

  // Once the focused comment is loaded: scroll to it, and mark it until the highlight has had its moment.
  const isFocusLoaded =
    focusId !== undefined && !!roots?.some((root) => root.id === focusId || root.replies.some((reply) => reply.id === focusId));
  useEffect(() => {
    if (focusId === undefined || !isFocusLoaded) return;
    list.current?.querySelector(`[data-comment-id="${focusId}"]`)?.scrollIntoView({ block: "center" });
    const timer = setTimeout(() => setFadedId(focusId), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [focusId, isFocusLoaded]);
  const highlightedId = isFocusLoaded && fadedId !== focusId ? (focusId ?? null) : null;

  if (!roots) {
    return isError && !isGone ? (
      <Alert status="danger" className="m-4">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t("posts.comments.loadError")}</Alert.Title>
        </Alert.Content>
        <Button size="sm" variant="secondary" onPress={() => void refetch()}>
          {t("posts.retry")}
        </Button>
      </Alert>
    ) : (
      <CommentsSkeleton />
    );
  }

  if (roots.length === 0) return <p className="px-4 py-8 text-center text-sm text-muted">{t("posts.comments.empty")}</p>;

  return (
    <div ref={list} className="px-4 pb-2">
      <ul className="flex flex-col gap-4">
        {roots.map((root) => (
          <CommentThread key={root.id} post={post} root={root} highlightedId={highlightedId} onReply={onReply} onEdit={onEdit} onDeleted={onDeleted} />
        ))}
      </ul>
      {hasNextPage && (
        <div className="flex flex-col items-start gap-1 pt-3">
          {isFetchNextPageError && !isFetchingNextPage && <p className="text-sm text-danger">{t("posts.comments.loadError")}</p>}
          <Button size="sm" variant="ghost" className="tap-target -ms-2 text-muted" isPending={isFetchingNextPage} onPress={() => void fetchNextPage()}>
            {t("posts.comments.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Rows of avatar and text while the first page loads. */
function CommentsSkeleton() {
  const { t } = useLocale();
  return (
    <div role="status" aria-label={t("posts.comments.loading")} className="flex flex-col gap-4 px-4 pb-4">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-32 rounded-full" />
            <Skeleton className="h-3.5 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
