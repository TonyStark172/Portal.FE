"use client";

import { CircleExclamation } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import { useMediaUrl } from "../../hooks/usePostFile";
import type { AlbumItem } from "../../hooks/useAlbum";
import { MediaThumb } from "../media/MediaThumb";

type DraftThumbProps = {
  item: AlbumItem;
  isSingle?: boolean;
  onRetry: () => void;
};

/** An album item while composing: the local preview (or the stored file), with its upload progress or failure. */
export function DraftThumb({ item, isSingle = false, onRetry }: DraftThumbProps) {
  const stored = useMediaUrl(item.preview ? null : item.fileId);
  const percent = Math.round(item.progress * 100);

  return (
    <>
      <MediaThumb kind={item.kind} src={item.preview ?? stored} alt={item.caption || item.name} isSingle={isSingle} />

      {item.status === "uploading" && (
        <span
          role="progressbar"
          aria-label={`Đang tải lên ${item.name}`}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="absolute inset-0 flex items-center justify-center bg-black/45"
        >
          <span className="text-sm font-semibold text-white tabular-nums">{percent}%</span>
          <span className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
            <span className="block h-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
          </span>
        </span>
      )}

      {/* Above any drag handle laid over the thumbnail, so "Thử lại" stays clickable. */}
      {item.status === "error" && (
        <span className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/65 p-2 text-center text-xs text-white">
          <CircleExclamation aria-hidden className="size-5" />
          Không tải lên được
          <Button size="sm" variant="secondary" onPress={onRetry}>
            Thử lại
          </Button>
        </span>
      )}
    </>
  );
}
