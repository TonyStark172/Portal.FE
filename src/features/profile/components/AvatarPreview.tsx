"use client";

import { useState } from "react";
import { Modal } from "@heroui/react";
import { useProtectedImage } from "@/shared/api/useProtectedImage";
import { UserAvatar } from "@/shared/ui/UserAvatar";

type AvatarPreviewProps = {
  fullName: string;
  avatarUrl: string | null | undefined;
};

/** The profile avatar; when it has an image, pressing it shows the image enlarged (up to 640×640). */
export function AvatarPreview({ fullName, avatarUrl }: AvatarPreviewProps) {
  // Loaded once here and shared with the small avatar, so the preview opens without a second download.
  const src = useProtectedImage(avatarUrl);
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

      <Modal.Backdrop isOpen={isOpen} onOpenChange={setOpen} variant="blur">
        <Modal.Container placement="center">
          <Modal.Dialog
            aria-label={`Ảnh đại diện của ${fullName}`}
            className="w-[min(640px,calc(100vw-2rem))] max-w-none bg-transparent p-0 shadow-none"
          >
            <Modal.CloseTrigger aria-label="Đóng" />
            {/* eslint-disable-next-line @next/next/no-img-element -- an object URL of an authenticated download, not a static asset next/image could optimise */}
            <img src={src} alt={fullName} className="aspect-square w-full rounded-2xl object-cover" />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
