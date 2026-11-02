"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutColumns, LayoutRows } from "@gravity-ui/icons";
import { Alert, Button, Modal, Skeleton, toast } from "@heroui/react";
import { useAppSelector } from "@/core/hooks";
import type { RootState } from "@/core/store";
import { portalApi, useGetPostQuery } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { postsApi } from "../../api";
import { useCommentsLayout } from "../../hooks/useCommentsLayout";
import { useCommentsUrl } from "../../hooks/useCommentsUrl";
import { PostBody, PostByline } from "../PostCard";
import { CommentComposer, type CommentComposerHandle } from "./CommentComposer";
import { CommentList } from "./CommentList";

// The cached feed and pinned list, read without asking for them (`as never`: the injected endpoints' state type is not
// the store's, as in api.ts).
const feedSelector = postsApi.endpoints.getFeed.select(undefined);
const pinnedSelector = portalApi.endpoints.getPinnedPosts.select(undefined);
const selectFeed = (state: RootState) => feedSelector(state as never);
const selectPinned = (state: RootState) => pinnedSelector(state as never);

/**
 * The comments popup, open while the address names a post (`?post=`). One column: the post and the comments scroll
 * together under a fixed title, with the composer fixed at the bottom. Two columns (a wide screen only): the post
 * on the left, the comments and the composer on the right, each scrolling by itself. A phone's is a full screen
 * that slides up. The layout is in globals.css (`.comments-*`).
 */
export function CommentsDialog() {
  const { t } = useLocale();
  const { postId, commentId, close } = useCommentsUrl();
  const { layout, toggle } = useCommentsLayout();
  const isOpen = postId !== null;
  const composer = useRef<CommentComposerHandle>(null);

  // The feed's copy shows at once; the post read alone (fresh rights and counts) replaces it.
  const feed = useAppSelector(selectFeed);
  const pinned = useAppSelector(selectPinned);
  const { currentData, error, isError, refetch } = useGetPostQuery(
    { id: postId ?? 0 },
    { skip: !isOpen, refetchOnMountOrArgChange: true },
  );
  const cached = [...(pinned.data ?? []), ...(feed.data?.pages.flatMap((page) => page.items) ?? [])].find(
    (post) => post.id === postId,
  );
  const current = currentData ?? cached;
  // As the popup fades out the address no longer names a post: the last one stays in it until it is gone.
  const [last, setLast] = useState(current);
  if (current && current !== last) setLast(current);
  const post = current ?? (isOpen ? undefined : last);
  // Likewise the comment the address pointed at: dropping it as the popup fades would read the list again.
  const [lastCommentId, setLastCommentId] = useState(commentId);
  if (isOpen && commentId !== lastCommentId) setLastCommentId(commentId);
  const focusId = (isOpen ? commentId : lastCommentId) ?? undefined;

  const isGone = isError && toApiProblem(error).status === 404;
  useEffect(() => {
    if (!isGone) return;
    toast.danger(t("posts.comments.postGone"));
    close();
  }, [isGone, close, t]);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && close()}>
      {/* A phone's is a full screen sliding up, as the new-post box is. */}
      <Modal.Container
        size="lg"
        scroll="inside"
        className="max-sm:p-0 max-sm:data-[entering=true]:slide-in-from-bottom-full max-sm:data-[entering=true]:zoom-in-100 max-sm:data-[exiting=true]:slide-out-to-bottom-full max-sm:data-[exiting=true]:zoom-out-100"
      >
        {/* A fixed height, so changing the layout or loading more never resizes the dialog. */}
        <Modal.Dialog
          data-layout={layout}
          className="comments-dialog p-0 max-sm:h-full max-sm:max-w-none max-sm:rounded-none sm:h-[min(52rem,100%)] sm:max-w-2xl lg:data-[layout=two]:max-w-6xl"
        >
          <Modal.Header className="flex-row items-center gap-2 border-b border-separator py-3 ps-4 pe-14 max-sm:pt-[max(0.75rem,env(safe-area-inset-top))]">
            <Modal.Heading className="min-w-0 flex-1 truncate">
              {post ? t("posts.comments.title").replace("{name}", post.author.fullName) : t("posts.comments.open")}
            </Modal.Heading>
            {/* Two columns need a wide screen. */}
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="tap-target hidden text-muted lg:inline-flex"
              aria-label={layout === "one" ? t("posts.comments.twoColumns") : t("posts.comments.oneColumn")}
              onPress={toggle}
            >
              {layout === "one" ? <LayoutColumns className="size-4" /> : <LayoutRows className="size-4" />}
            </Button>
          </Modal.Header>
          <Modal.CloseTrigger aria-label={t("posts.close")} className="end-3 top-3 max-sm:top-[max(0.75rem,env(safe-area-inset-top))]" />

          <div className="comments-body">
            <div className="comments-scroll">
              <div className="comments-post flex flex-col gap-3 p-4">
                {post ? (
                  <>
                    <PostByline post={post} />
                    <PostBody post={post} />
                  </>
                ) : isError ? (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{t("posts.loadError")}</Alert.Title>
                    </Alert.Content>
                    <Button size="sm" variant="secondary" onPress={() => void refetch()}>
                      {t("posts.retry")}
                    </Button>
                  </Alert>
                ) : (
                  <PostSkeleton />
                )}
              </div>
              <div className="comments-list">
                {post && (
                  <CommentList
                    post={post}
                    focusId={focusId}
                    onReply={(target) => composer.current?.reply(target)}
                    onEdit={(comment) => composer.current?.edit(comment)}
                    onDeleted={() => composer.current?.focus()}
                    onMissing={close}
                  />
                )}
              </div>
            </div>
            <div className="comments-composer border-t border-separator max-sm:pb-[env(safe-area-inset-bottom)]">
              {post && <CommentComposer key={post.id} ref={composer} post={post} />}
            </div>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** The post while it loads. */
function PostSkeleton() {
  const { t } = useLocale();
  return (
    <div role="status" aria-label={t("posts.loadMore")} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-1/3 rounded-md" />
          <Skeleton className="h-3 w-1/4 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-4 w-full rounded-md" />
      <Skeleton className="h-4 w-5/6 rounded-md" />
    </div>
  );
}
