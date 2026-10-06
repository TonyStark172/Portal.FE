"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, Xmark } from "@gravity-ui/icons";
import { Modal, Spinner } from "@heroui/react";
import type { PostMediaDto } from "@/shared/api/generated/portalApi";
import { useMediaUrl } from "../../hooks/usePostFile";

type MediaViewerProps = {
  media: PostMediaDto[];
  /** The item shown; null when the viewer is closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
};

const roundButton =
  "flex size-10 items-center justify-center rounded-full bg-white/15 text-white outline-none transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white";

/** The album full screen, one item at a time: ← → (buttons or keys), "3/8", the caption, videos with controls. */
export function MediaViewer({ media, index, onIndexChange }: MediaViewerProps) {
  const item = index === null ? null : media[index];
  const src = useMediaUrl(item?.id);
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < media.length - 1;

  // Arrow keys move through the album, except while a video has focus (there they seek).
  useEffect(() => {
    if (index === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLVideoElement) return;
      if (event.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      if (event.key === "ArrowRight" && index < media.length - 1) onIndexChange(index + 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, media.length, onIndexChange]);

  return (
    <Modal.Backdrop isOpen={item !== null} onOpenChange={(open) => !open && onIndexChange(null)}>
      <Modal.Container size="full">
        <Modal.Dialog aria-label="Xem ảnh và video" className="bg-black p-0 text-white">
          {item && (
            <div className="relative flex h-full flex-col">
              <div className="flex items-center justify-between gap-3 p-3">
                <span aria-live="polite" className="text-sm font-medium tabular-nums text-white/80">
                  {index! + 1}/{media.length}
                </span>
                <button type="button" aria-label="Đóng" onClick={() => onIndexChange(null)} className={roundButton}>
                  <Xmark className="size-5" />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 items-center justify-center px-3 pb-3 sm:px-16">
                {!src ? (
                  <Spinner size="lg" aria-label="Đang tải" />
                ) : item.kind === "Video" ? (
                  <video key={item.id} src={src} controls autoPlay playsInline className="max-h-full max-w-full" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- a presigned storage URL, not a static asset
                  <img key={item.id} src={src} alt={item.caption || item.fileName} className="max-h-full max-w-full object-contain" />
                )}
              </div>

              {item.caption && (
                <p className="max-h-32 overflow-y-auto whitespace-pre-line px-4 pb-4 text-center text-sm text-white/90">
                  {item.caption}
                </p>
              )}

              {hasPrev && (
                <button
                  type="button"
                  aria-label="Trước"
                  onClick={() => onIndexChange(index! - 1)}
                  className={`${roundButton} absolute start-3 top-1/2 -translate-y-1/2`}
                >
                  <ChevronLeft className="size-5" />
                </button>
              )}
              {hasNext && (
                <button
                  type="button"
                  aria-label="Tiếp theo"
                  onClick={() => onIndexChange(index! + 1)}
                  className={`${roundButton} absolute end-3 top-1/2 -translate-y-1/2`}
                >
                  <ChevronRight className="size-5" />
                </button>
              )}
            </div>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
