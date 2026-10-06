"use client";

import { useState, type Key } from "react";
import { Ellipsis, Pencil, Pin, PinSlash, TrashBin } from "@gravity-ui/icons";
import { AlertDialog, Button, Dropdown, Label, toast } from "@heroui/react";
import { useDeletePostMutation, useUnpinPostMutation, type PostDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { PinDialog } from "./PinDialog";

/**
 * The ⋯ menu of a post: edit (author), pin/unpin (moderator) and delete (author or moderator),
 * with a confirmation before deleting.
 */
export function PostActions({ post, onEdit }: { post: PostDto; onEdit: () => void }) {
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
        .then(() => toast.success("Đã bỏ ghim bài viết"))
        .catch((error) => toast.danger(toApiProblem(error).detail ?? "Không bỏ ghim được."));
    if (key === "delete") setConfirmOpen(true);
  }

  async function handleDelete() {
    try {
      await deletePost({ id: post.id }).unwrap();
      setConfirmOpen(false);
      toast.success("Đã xoá bài viết");
    } catch (error) {
      toast.danger(toApiProblem(error).detail ?? "Không xoá được bài viết.");
    }
  }

  return (
    <>
      <Dropdown>
        <Dropdown.Trigger aria-label="Tuỳ chọn bài viết" className="rounded-full p-1.5 text-muted outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus">
          <Ellipsis className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu aria-label="Tuỳ chọn bài viết" onAction={handleAction}>
            {post.canEdit ? (
              <Dropdown.Item id="edit" textValue="Sửa">
                <Pencil className="size-4 shrink-0 text-muted" />
                <Label>Sửa</Label>
              </Dropdown.Item>
            ) : null}
            {post.canPin ? (
              <Dropdown.Item id="pin" textValue={post.isPinned ? "Đổi thời hạn ghim" : "Ghim bài"}>
                <Pin className="size-4 shrink-0 text-muted" />
                <Label>{post.isPinned ? "Đổi thời hạn ghim" : "Ghim bài"}</Label>
              </Dropdown.Item>
            ) : null}
            {post.canPin && post.isPinned ? (
              <Dropdown.Item id="unpin" textValue="Bỏ ghim">
                <PinSlash className="size-4 shrink-0 text-muted" />
                <Label>Bỏ ghim</Label>
              </Dropdown.Item>
            ) : null}
            {post.canDelete ? (
              <Dropdown.Item id="delete" textValue="Xoá" variant="danger">
                <TrashBin className="size-4 shrink-0 text-danger" />
                <Label>Xoá</Label>
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
              <AlertDialog.Heading>Xoá bài viết?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>Bài viết cùng ảnh và tệp đính kèm sẽ bị xoá vĩnh viễn.</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Huỷ
              </Button>
              <Button variant="danger" isPending={isDeleting} onPress={handleDelete}>
                Xoá
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
}
