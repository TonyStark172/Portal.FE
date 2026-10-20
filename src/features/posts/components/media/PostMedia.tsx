"use client";

import { useState } from "react";
import type { PostMediaDto } from "@/shared/api/generated/portalApi";
import { useMediaUrl } from "../../hooks/usePostFile";
import { MediaGrid } from "./MediaGrid";
import { MediaThumb } from "./MediaThumb";
import { MediaViewer } from "./MediaViewer";

/** A post's album on the feed: the collage, opening the viewer on the item clicked. */
export function PostMedia({ media }: { media: PostMediaDto[] }) {
  const [index, setIndex] = useState<number | null>(null);
  if (media.length === 0) return null;

  return (
    <>
      <MediaGrid
        count={media.length}
        renderTile={(i, { isSingle, more }) => (
          <button
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`${more > 0 ? `Xem thêm ${more} mục, ` : ""}${media[i].kind === "Video" ? "video" : "ảnh"} ${i + 1}/${media.length}`}
            className="group block size-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
          >
            <StoredThumb item={media[i]} isSingle={isSingle} />
            <span aria-hidden className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
            {more > 0 && <MoreOverlay count={more} />}
          </button>
        )}
      />
      <MediaViewer media={media} index={index} onIndexChange={setIndex} />
    </>
  );
}

function StoredThumb({ item, isSingle }: { item: PostMediaDto; isSingle: boolean }) {
  const src = useMediaUrl(item.id);
  return <MediaThumb kind={item.kind === "Video" ? "Video" : "Image"} src={src} alt={item.caption || item.fileName} isSingle={isSingle} />;
}

/** "+N" over the last tile when the album has more than the grid shows. */
export function MoreOverlay({ count }: { count: number }) {
  return (
    <span aria-hidden className="absolute inset-0 flex items-center justify-center bg-black/55 text-3xl font-semibold text-white">
      +{count}
    </span>
  );
}
