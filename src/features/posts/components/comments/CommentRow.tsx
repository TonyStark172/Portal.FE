"use client";

import { useState, type Key } from "react";
import { Ellipsis, Pencil, TrashBin } from "@gravity-ui/icons";
import { AlertDialog, Button, Dropdown, Label, Tooltip, toast } from "@heroui/react";
import {
  useDeletePostCommentMutation,
  type PostCommentDto,
  type PostDto,
  type PostMediaDto,
} from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { useMediaUrl } from "../../hooks/usePostFile";
import { formatCompact } from "../../lib/count";
import { reactionOf } from "../../lib/reactions";
import { formatFullTime, formatPostTime } from "../../lib/time";
import { AttachmentList } from "../AttachmentList";
import { MediaThumb } from "../media/MediaThumb";
import { MediaViewer } from "../media/MediaViewer";
import { PostContent } from "../PostContent";
import { ReactButton, ReactionsModal, type ReactionTarget } from "../PostReactions";

type CommentRowProps = {
  post: PostDto;
  comment: PostCommentDto;
  onReply: (target: PostCommentDto) => void;
  onEdit: (comment: PostCommentDto) => void;
  /** The comment was deleted: its row, and the focus with it, is gone. */
  onDeleted: (id: number) => void;
  /** The row is the one a link pointed at (CommentList sets it for a moment). */
  isHighlighted?: boolean;
  /** Replies hang under the row: a line runs down from its avatar to them. */
  hasReplies?: boolean;
};

/**
 * One comment or reply: who wrote it and when, the text and its picture or video, the reactions, "Trả lời" and the
 * ⋯ menu (edit and delete, by the rights Portal.BE sent). A deleted comment that has replies is a line of text alone.
 */
export function CommentRow({ post, comment, onReply, onEdit, onDeleted, isHighlighted = false, hasReplies = false }: CommentRowProps) {
  const { t } = useLocale();

  return (
    <div
      data-comment-id={comment.id}
      data-highlighted={isHighlighted ? "" : undefined}
      className="comment-row flex min-w-0 gap-3 rounded-xl"
    >
      {/* The avatar column; with replies below, a line runs down it to them (and curves into each, in CommentThread). */}
      <div className="flex w-8 shrink-0 flex-col items-center gap-1">
        {comment.author ? (
          <UserAvatar fullName={comment.author.fullName} avatarUrl={comment.author.avatarUrl} size="sm" />
        ) : (
          <span aria-hidden className="size-8 rounded-full bg-default" />
        )}
        {hasReplies && <span aria-hidden className="comment-line w-0 flex-1" />}
      </div>

      <div className="min-w-0 flex-1 pb-1">
        {comment.isDeleted || !comment.author ? (
          <p className="py-1.5 text-sm italic text-muted">{t("posts.comments.deleted")}</p>
        ) : (
          <CommentContent post={post} comment={comment} author={comment.author} onReply={onReply} onEdit={onEdit} onDeleted={onDeleted} />
        )}
      </div>
    </div>
  );
}

function CommentContent({
  post,
  comment,
  author,
  onReply,
  onEdit,
  onDeleted,
}: {
  post: PostDto;
  comment: PostCommentDto;
  author: NonNullable<PostCommentDto["author"]>;
  onReply: (target: PostCommentDto) => void;
  onEdit: (comment: PostCommentDto) => void;
  onDeleted: (id: number) => void;
}) {
  const { locale, t } = useLocale();
  const [isListOpen, setListOpen] = useState(false);
  const total = comment.reactions.reduce((sum, r) => sum + r.count, 0);
  const target: ReactionTarget = { kind: "comment", id: comment.id, reactions: comment.reactions, myReaction: comment.myReaction };

  return (
    <>
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-sm font-semibold text-foreground">{author.fullName}</span>
            {comment.isPostAuthor && (
              <span className="rounded-full bg-accent-soft px-1.5 text-[11px] font-medium leading-5 text-accent">
                {t("posts.comments.author")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted">
            {author.positionName && <span>{author.positionName} ·</span>}
            <Tooltip delay={300}>
              <Tooltip.Trigger aria-label={formatFullTime(comment.createdAt, locale)} className="tap-target rounded">
                <time dateTime={comment.createdAt}>{formatPostTime(comment.createdAt, undefined, locale)}</time>
              </Tooltip.Trigger>
              <Tooltip.Content>{formatFullTime(comment.createdAt, locale)}</Tooltip.Content>
            </Tooltip>
            {comment.editedAt && <span>· {t("posts.comments.edited")}</span>}
          </div>
        </div>
        <CommentMenu comment={comment} onEdit={onEdit} onDeleted={onDeleted} />
      </div>

      {comment.contentHtml && (
        <div className="text-sm">
          <PostContent html={comment.contentHtml} />
        </div>
      )}
      {comment.file && <CommentFile file={comment.file} />}

      <div className="-ms-2 mt-0.5 flex flex-wrap items-center gap-x-1">
        <ReactButton compact target={target} />
        {!post.commentsDisabled && (
          <Button size="sm" variant="ghost" className="tap-target h-7 min-w-0 px-2 text-xs text-muted" onPress={() => onReply(comment)}>
            {t("posts.comments.reply")}
          </Button>
        )}
        {total > 0 && (
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="tap-target ms-auto flex items-center gap-1 rounded-full px-1 py-0.5 text-xs text-muted outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span aria-hidden className="flex shrink-0">
              {comment.reactions.slice(0, 3).map((r) => (
                <span key={r.kind} className="-ms-0.5 first:ms-0">
                  {reactionOf(r.kind).emoji}
                </span>
              ))}
            </span>
            <span>{formatCompact(total)}</span>
            <span className="sr-only">— {t("posts.viewReactions")}</span>
          </button>
        )}
      </div>

      {total > 0 && <ReactionsModal target={target} isOpen={isListOpen} onOpenChange={setListOpen} />}
    </>
  );
}

/** The file of a comment: a file to download, or a picture or video opening the viewer. */
function CommentFile({ file }: { file: PostMediaDto }) {
  if (file.kind !== "Attachment") return <CommentMedia file={file} />;
  return (
    <div className="mt-1 max-w-72">
      <AttachmentList attachments={[file]} />
    </div>
  );
}

function CommentMedia({ file }: { file: PostMediaDto }) {
  const { t } = useLocale();
  const [isOpen, setOpen] = useState(false);
  const src = useMediaUrl(file.id);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("posts.mediaViewer")}
        className="relative mt-1 block w-full max-w-72 cursor-pointer overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <MediaThumb kind={file.kind === "Video" ? "Video" : "Image"} src={src} alt={file.fileName} isSingle />
      </button>
      <MediaViewer media={[file]} index={isOpen ? 0 : null} onIndexChange={(index) => setOpen(index !== null)} />
    </>
  );
}

/** The ⋯ menu: edit (the author) and delete (the author, the post's owner, a moderator), asking before deleting. */
function CommentMenu({ comment, onEdit, onDeleted }: { comment: PostCommentDto; onEdit: (comment: PostCommentDto) => void; onDeleted: (id: number) => void }) {
  const { t } = useLocale();
  const [deleteComment, { isLoading: isDeleting }] = useDeletePostCommentMutation();
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  if (!comment.canEdit && !comment.canDelete) return null;

  function handleAction(key: Key) {
    if (key === "edit") onEdit(comment);
    if (key === "delete") setConfirmOpen(true);
  }

  async function handleDelete() {
    try {
      await deleteComment({ id: comment.id }).unwrap();
      setConfirmOpen(false);
      onDeleted(comment.id);
    } catch (error) {
      toast.danger(toApiProblem(error).detail ?? t("posts.comments.deleteError"));
    }
  }

  return (
    <>
      <Dropdown>
        <Dropdown.Trigger
          aria-label={t("posts.comments.options")}
          className="tap-target rounded-full p-1.5 text-muted outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Ellipsis className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu aria-label={t("posts.comments.options")} onAction={handleAction}>
            {comment.canEdit ? (
              <Dropdown.Item id="edit" textValue={t("posts.editAction")}>
                <Pencil className="size-4 shrink-0 text-muted" />
                <Label>{t("posts.editAction")}</Label>
              </Dropdown.Item>
            ) : null}
            {comment.canDelete ? (
              <Dropdown.Item id="delete" textValue={t("posts.delete")} variant="danger">
                <TrashBin className="size-4 shrink-0 text-danger" />
                <Label>{t("posts.delete")}</Label>
              </Dropdown.Item>
            ) : null}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <AlertDialog.Backdrop isOpen={isConfirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-sm">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>{t("posts.comments.deleteTitle")}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                {t("posts.cancel")}
              </Button>
              <Button variant="danger" isPending={isDeleting} onPress={handleDelete}>
                {t("posts.delete")}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
}
