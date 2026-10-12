"use client";

import { useState, type Key } from "react";
import { Ellipsis, Pencil, Pin, PinSlash, TrashBin } from "@gravity-ui/icons";
import { AlertDialog, Button, Dropdown, Label, toast } from "@heroui/react";
import { useDeletePostMutation, useUnpinPostMutation, type PostDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { PinDialog } from "./PinDialog";
import { useLocale } from "@/shared/i18n";

/**
 * The ⋯ menu of a post: edit (author), pin/unpin (moderator) and delete (author or moderator),
 * with a confirmation before deleting.
 */
export function PostActions({ post, onEdit }: { post: PostDto; onEdit: () => void }) {
  const { t } = useLocale();
  const [deletePost, { isLoading: isDeleting }] = useDeletePostMutation();
  const [unpinPost] = useUnpinPostMutation();
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isPinOpen, setPinOpen] = useState(false);

  if (!post.canEdit && !post.canDelete && !post.canPin) return null;

  function handleAction(key: Key) {
    if (key === "edit") onEdit();
    if (key === "pin") setPinOpen(true);
    if (key === "unpin")
      unpinPost({ id: post.id })
        .unwrap()
        .then(() => toast.success(t("posts.unpinSuccess")))
        .catch((error) => toast.danger(toApiProblem(error).detail ?? t("posts.unpinError")));
    if (key === "delete") setConfirmOpen(true);
  }

  async function handleDelete() {
    try {
      await deletePost({ id: post.id }).unwrap();
      setConfirmOpen(false);
      toast.success(t("posts.deleteSuccess"));
    } catch (error) {
      toast.danger(toApiProblem(error).detail ?? t("posts.deleteError"));
    }
  }

  return (
    <>
      <Dropdown>
        <Dropdown.Trigger aria-label={t("posts.options")} className="tap-target rounded-full p-1.5 text-muted outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus">
          <Ellipsis className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu aria-label={t("posts.options")} onAction={handleAction}>
            {post.canEdit ? (
              <Dropdown.Item id="edit" textValue={t("posts.editAction")}>
                <Pencil className="size-4 shrink-0 text-muted" />
                <Label>{t("posts.editAction")}</Label>
              </Dropdown.Item>
            ) : null}
            {post.canPin ? (
              <Dropdown.Item id="pin" textValue={post.isPinned ? t("posts.changePin") : t("posts.pin")}>
                <Pin className="size-4 shrink-0 text-muted" />
                <Label>{post.isPinned ? t("posts.changePin") : t("posts.pin")}</Label>
              </Dropdown.Item>
            ) : null}
            {post.canPin && post.isPinned ? (
              <Dropdown.Item id="unpin" textValue={t("posts.unpin")}>
                <PinSlash className="size-4 shrink-0 text-muted" />
                <Label>{t("posts.unpin")}</Label>
              </Dropdown.Item>
            ) : null}
            {post.canDelete ? (
              <Dropdown.Item id="delete" textValue={t("posts.delete")} variant="danger">
                <TrashBin className="size-4 shrink-0 text-danger" />
                <Label>{t("posts.delete")}</Label>
              </Dropdown.Item>
            ) : null}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      {post.canPin && <PinDialog key={String(isPinOpen)} post={post} isOpen={isPinOpen} onOpenChange={setPinOpen} />}

      <AlertDialog.Backdrop isOpen={isConfirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-sm">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>{t("posts.deleteTitle")}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>{t("posts.deleteDescription")}</p>
            </AlertDialog.Body>
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
