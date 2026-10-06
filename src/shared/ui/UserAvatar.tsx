"use client";

import { Avatar } from "@heroui/react";
import { useProtectedImage } from "@/shared/api/useProtectedImage";

type UserAvatarProps = {
  fullName: string | undefined;
  /** Relative avatar URL from Portal.BE (e.g. ProfileDto.avatarUrl); the initial is shown without it. */
  avatarUrl?: string | null;
  /** An image the caller already loaded (object URL from `useProtectedImage`), used instead of `avatarUrl`. */
  src?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/** A user's avatar image, or the first letter of their given name (the last word of a Vietnamese name). */
export function UserAvatar({ fullName, avatarUrl, src: loadedSrc, size = "sm", className }: UserAvatarProps) {
  const fetchedSrc = useProtectedImage(loadedSrc ? null : avatarUrl);
  const src = loadedSrc ?? fetchedSrc;

  return (
    <Avatar size={size} className={className}>
      {src && <Avatar.Image src={src} alt={fullName ?? ""} />}
      {/* With an image, wait briefly before showing the initial so a fast image never flashes the fallback. */}
      <Avatar.Fallback delayMs={src ? 600 : undefined}>{initial(fullName)}</Avatar.Fallback>
    </Avatar>
  );
}

function initial(fullName: string | undefined): string {
  if (!fullName) return "?";
  return (fullName.trim().split(/\s+/).at(-1)?.[0] ?? "?").toUpperCase();
}
