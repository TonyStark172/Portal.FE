"use client";

import type { ReactNode } from "react";
import { DEFAULT_BANNER_COLOR } from "../editor/palette";
import { usePostImage } from "../hooks/usePostFile";

type AnnouncementBannerProps = {
  bannerColor: string | null | undefined;
  bannerImageId: string | null | undefined;
  /** Image shown before it is uploaded (composer preview). */
  localImageUrl?: string;
  children: ReactNode;
};

/** The large headline area of an announcement: white text over a palette colour or a darkened image. */
export function AnnouncementBanner({ bannerColor, bannerImageId, localImageUrl, children }: AnnouncementBannerProps) {
  const uploadedImage = usePostImage(localImageUrl ? null : bannerImageId);
  const image = localImageUrl ?? uploadedImage;
  const hasImage = Boolean(bannerImageId || localImageUrl);

  return (
    <div
      data-color={hasImage ? undefined : (bannerColor ?? DEFAULT_BANNER_COLOR)}
      className="post-banner relative overflow-hidden rounded-xl bg-default bg-cover bg-center px-5 py-6 text-white"
      style={image ? { backgroundImage: `url(${image})` } : undefined}
    >
      {/* Keeps white text readable on any photo. */}
      {hasImage && <div aria-hidden className="absolute inset-0 bg-black/45" />}
      <div className="relative flex flex-col gap-1">{children}</div>
    </div>
  );
}
