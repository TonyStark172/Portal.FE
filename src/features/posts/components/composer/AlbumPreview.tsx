"use client";

import { Pencil, Xmark } from "@gravity-ui/icons";
import { Button, Tooltip } from "@heroui/react";
import { useLocale } from "@/shared/i18n";
import type { Album } from "../../hooks/useAlbum";
import { MediaGrid } from "../media/MediaGrid";
import { MoreOverlay } from "../media/PostMedia";
import { DraftThumb } from "./DraftThumb";

/** The album in the composer, as it will look on the feed, with "Chỉnh sửa tất cả" and ✕ (remove all). */
export function AlbumPreview({ album, onEdit }: { album: Album; onEdit: () => void }) {
  const { t } = useLocale();
  if (album.items.length === 0) return null;

  return (
    <div className="relative">
      <MediaGrid
        count={album.items.length}
        renderTile={(i, { isSingle, more }) => (
          <>
            <DraftThumb item={album.items[i]} isSingle={isSingle} onRetry={() => album.retry(album.items[i].key)} />
            {more > 0 && <MoreOverlay count={more} />}
          </>
        )}
      />

      <Button size="sm" variant="secondary" onPress={onEdit} className="absolute start-2 top-2 z-20 shadow-md">
        <Pencil className="size-4" />
        {t("posts.album.editAll")}
      </Button>
      <Tooltip delay={400}>
        <Button
          isIconOnly
          size="sm"
          variant="secondary"
          aria-label={t("posts.album.removeAll")}
          onPress={album.clear}
          className="absolute end-2 top-2 z-20 rounded-full shadow-md"
        >
          <Xmark className="size-4" />
        </Button>
        <Tooltip.Content>{t("posts.album.removeAll")}</Tooltip.Content>
      </Tooltip>
    </div>
  );
}
