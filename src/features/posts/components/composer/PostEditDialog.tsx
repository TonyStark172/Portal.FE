"use client";

import { Modal } from "@heroui/react";
import type { PostDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { PostComposer } from "./PostComposer";

/** The composer in a popup, editing `post` while there is one. */
export function PostEditDialog({ post, onClose }: { post: PostDto | null; onClose: () => void }) {
  const { t } = useLocale();

  return (
    // Closing goes through the composer's ✕, which asks before discarding edits (not Esc or a click outside). The popup
    // this may sit in hears of keys through React's tree, and would take an Esc as its own.
    <div
      className="contents"
      onKeyDown={(event) => {
        if (event.key === "Escape") event.stopPropagation();
      }}
    >
      <Modal.Backdrop isOpen={post !== null} onOpenChange={(open) => !open && onClose()} isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container size="lg" scroll="outside">
          <Modal.Dialog aria-label={t("posts.edit")}>{post && <PostComposer key={post.id} post={post} onDone={onClose} />}</Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
