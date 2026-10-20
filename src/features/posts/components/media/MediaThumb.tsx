"use client";

import { useState } from "react";
import { PlayFill } from "@gravity-ui/icons";
import { Skeleton } from "@heroui/react";
import type { MediaKind } from "../../lib/fileRules";
import { formatDuration } from "../../lib/time";

type MediaThumbProps = {
  kind: MediaKind;
  /** Object URL of a picked file or the presigned URL of an uploaded one; undefined while loading. */
  src: string | undefined;
  alt: string;
  /** The album's only item: shown at its own shape instead of filling a cell. */
  isSingle?: boolean;
};

/** An album item as a picture: the image, or a video's first frame with ▶ and its length. */
export function MediaThumb({ kind, src, alt, isSingle = false }: MediaThumbProps) {
  const [duration, setDuration] = useState<number | null>(null);

  if (!src) return <Skeleton className={`rounded-none ${isSingle ? "aspect-video w-full" : "size-full"}`} />;

  if (kind === "Image")
    return (
      // eslint-disable-next-line @next/next/no-img-element -- an object URL or a presigned storage URL, not a static asset
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={isSingle ? "block max-h-[32rem] w-full object-cover" : "size-full object-cover"}
      />
    );

  return (
    <>
      {/* "#t=0.1" makes browsers that show nothing before playing (Safari) draw the first frame. */}
      <video
        src={`${src}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        aria-label={alt}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        className={isSingle ? "block aspect-video w-full bg-black object-contain" : "size-full bg-black object-cover"}
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-black/55 text-white">
          <PlayFill className="size-5" />
        </span>
      </span>
      {duration !== null && Number.isFinite(duration) && (
        <span className="pointer-events-none absolute end-2 bottom-2 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
          {formatDuration(duration)}
        </span>
      )}
    </>
  );
}
