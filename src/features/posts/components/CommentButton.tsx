"use client";

import { Comment } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import type { PostDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { formatCompact } from "../lib/count";

/** The comment count of a post (or an invitation, or that comments are off); opens its comments. */
export function CommentButton({ post, onOpen }: { post: PostDto; onOpen: (post: PostDto) => void }) {
  const { t } = useLocale();
  const label =
    post.commentCount > 0
      ? t("posts.comments.count").replace("{count}", formatCompact(post.commentCount))
      : post.commentsDisabled
        ? t("posts.comments.off")
        : t("posts.comments.open");

  return (
    <Button size="sm" variant="ghost" className="tap-target shrink-0 text-muted max-sm:px-2" onPress={() => onOpen(post)}>
      <Comment className="size-4" />
      {label}
    </Button>
  );
}
