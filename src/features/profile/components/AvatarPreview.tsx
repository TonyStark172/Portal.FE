"use client";

import { useState } from "react";
import { useProtectedImage } from "@/shared/api/useProtectedImage";
import { ImagePreviewModal } from "@/shared/ui/ImagePreviewModal";
import { UserAvatar } from "@/shared/ui/UserAvatar";

type AvatarPreviewProps = {
  fullName: string;
  avatarUrl: string | null | undefined;
  /** Shown instead of the saved avatar: a picture not saved yet (object URL), or null for none. */
  src?: string | null;
};

/** The profile avatar; when it has an image, pressing it shows the image enlarged (up to 640×640). */
export function AvatarPreview({ fullName, avatarUrl, src: override }: AvatarPreviewProps) {
  // Loaded once here and shared with the small avatar, so the preview opens without a second download.
  const saved = useProtectedImage(override === undefined ? avatarUrl : null);
  const src = override === undefined ? saved : (override ?? undefined);
  const [isOpen, setOpen] = useState(false);

  const avatar = <UserAvatar fullName={fullName} src={src} className="size-14 shrink-0 rounded-full" />;
  if (!src) return avatar;

  return (
    <>
      <button
        type="button"
        aria-label="Xem ảnh đại diện"
        onClick={() => setOpen(true)}
        className="shrink-0 cursor-zoom-in rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {avatar}
      </button>

      <ImagePreviewModal
        src={src}
        alt={fullName}
        label={`Ảnh đại diện của ${fullName}`}
        isOpen={isOpen}
        onOpenChange={setOpen}
        square
      />
    </>
  );
}
