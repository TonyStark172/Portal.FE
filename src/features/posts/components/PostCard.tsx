"use client";

import { Pin } from "@gravity-ui/icons";
import { Card, Tooltip } from "@heroui/react";
import type { PostDto } from "@/shared/api/generated/portalApi";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { formatFullTime, formatPinnedUntil, formatPostTime } from "../lib/time";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { AttachmentList } from "./AttachmentList";
import { PostMedia } from "./media/PostMedia";
import { PostActions } from "./PostActions";
import { PostContent } from "./PostContent";
import { PostReactions } from "./PostReactions";

/** One post on the feed. */
export function PostCard({ post, onEdit }: { post: PostDto; onEdit: (post: PostDto) => void }) {
  const isAnnouncement = post.kind === "Announcement";

  return (
    <Card className="gap-3">
      <div className="flex items-start gap-3">
        <UserAvatar fullName={post.author.fullName} avatarUrl={post.author.avatarUrl} size="md" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{post.author.fullName}</div>
          <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted">
            {post.author.positionName && <span>{post.author.positionName} ·</span>}
            <Tooltip delay={300}>
              <Tooltip.Trigger aria-label={formatFullTime(post.createdAt)} className="rounded">
                <time dateTime={post.createdAt}>{formatPostTime(post.createdAt)}</time>
              </Tooltip.Trigger>
              <Tooltip.Content>{formatFullTime(post.createdAt)}</Tooltip.Content>
            </Tooltip>
            {post.editedAt && <span>· Đã chỉnh sửa</span>}
          </div>
          {post.isPinned && (
            <div className="mt-1 flex items-center gap-1 text-xs font-medium text-accent">
              <Pin aria-hidden className="size-3.5" />
              {post.pinnedUntil ? `Đã ghim · đến ${formatPinnedUntil(post.pinnedUntil)}` : "Đã ghim"}
            </div>
          )}
        </div>
        <PostActions post={post} onEdit={() => onEdit(post)} />
      </div>

      {isAnnouncement ? (
        <AnnouncementBanner bannerColor={post.bannerColor} bannerImageId={post.bannerImageId}>
          <h2 className="text-2xl font-bold leading-tight">{post.subject}</h2>
          {post.subhead && <p className="text-base text-white/90">{post.subhead}</p>}
        </AnnouncementBanner>
      ) : (
        post.subject && <h2 className="text-lg font-semibold text-foreground">{post.subject}</h2>
      )}

      {post.contentHtml && <PostContent html={post.contentHtml} />}
      <PostMedia media={post.media} />
      <AttachmentList attachments={post.attachments} />
      <PostReactions post={post} />
    </Card>
  );
}
