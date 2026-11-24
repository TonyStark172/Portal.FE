"use client";

import { useCallback, useState } from "react";
import { useStore } from "react-redux";
import { skipToken } from "@reduxjs/toolkit/query";
import { Skeleton, toast } from "@heroui/react";
import { ArrowDownToLine } from "@gravity-ui/icons";
import { FileFormatIcon, formatFileSize } from "@/features/posts/components/AttachmentList";
import { fetchProtected } from "@/shared/api/fetchProtected";
import type { ChatAttachmentDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import type { SessionState } from "@/shared/session/sessionSlice";
import { ImagePreviewModal } from "@/shared/ui/ImagePreviewModal";
import { chatAttachmentPath, chatThumbnailPath, useGetChatMediaUrlQuery } from "../api";
import { useChatImage, useSeen } from "../hooks/useChatImage";

/** The largest a lone image is drawn in a bubble (CSS pixels); its smaller copy has twice as many for dense screens. */
const MAX_BUBBLE_HEIGHT = 288;
const MAX_BUBBLE_WIDTH = 320;

/** Downloads a file under its original name (a plain link could not send the access token). */
export function useDownloadChatAttachment() {
  const store = useStore<{ session: SessionState }>();
  return useCallback(
    async (attachment: ChatAttachmentDto) => {
      const response = await fetchProtected(store, chatAttachmentPath(attachment.id));
      if (!response.ok) throw new Error(String(response.status));
      const url = URL.createObjectURL(await response.blob());
      const link = Object.assign(document.createElement("a"), { href: url, download: attachment.fileName });
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    [store],
  );
}

/**
 * What a list or a bubble shows of an image: its smaller copy, downloaded once it comes near the screen. A GIF is shown
 * itself where it should move (`animated`), since its smaller copy is a still.
 */
export function useChatThumbnail(attachment: ChatAttachmentDto, seen: boolean, animated = false): string | undefined {
  const moving = animated && attachment.contentType === "image/gif";
  return useChatImage(moving ? chatAttachmentPath(attachment.id) : chatThumbnailPath(attachment.id), seen);
}

/** The size a lone image takes in a bubble, known before it loads when the server measured it. */
export function bubbleImageSize(attachment: Pick<ChatAttachmentDto, "width" | "height">): { width: number; height: number } | null {
  const { width, height } = attachment;
  if (!width || !height) return null;
  const scale = Math.min(1, MAX_BUBBLE_HEIGHT / height, MAX_BUBBLE_WIDTH / width);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * An image in a bubble: a placeholder of its final shape until its smaller copy is there (nothing below it moves when it
 * arrives), then the copy fading in. The image itself is only downloaded when it is opened.
 */
function ChatImage({ attachment, single }: { attachment: ChatAttachmentDto; single: boolean }) {
  const { t } = useLocale();
  const [ref, seen] = useSeen<HTMLButtonElement>();
  const thumbnail = useChatThumbnail(attachment, seen, true);
  const [shown, setShown] = useState(false);
  const [isOpen, setOpen] = useState(false);
  const original = useChatImage(chatAttachmentPath(attachment.id), isOpen);
  const size = single ? bubbleImageSize(attachment) : null;

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("messages.openImage").replace("{name}", attachment.fileName)}
        style={size ? { width: size.width, aspectRatio: `${size.width} / ${size.height}` } : undefined}
        className={`relative block overflow-hidden rounded-xl bg-default outline-none focus-visible:ring-2 focus-visible:ring-focus ${
          single ? (size ? "max-w-full" : `max-w-full ${shown ? "" : "size-40"}`) : "aspect-square w-full"
        }`}
      >
        {!shown && <Skeleton aria-hidden className="absolute inset-0 rounded-none" />}
        {thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element -- an object URL of an authenticated download
          <img
            src={thumbnail}
            alt={attachment.fileName}
            decoding="async"
            onLoad={() => setShown(true)}
            className={`transition-opacity duration-200 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"} ${
              single && !size ? "max-h-72 w-auto max-w-full object-contain" : "size-full object-cover"
            }`}
          />
        )}
      </button>
      {/* The smaller copy at once, the image itself over it when it has come. */}
      <ImagePreviewModal src={original ?? thumbnail} alt={attachment.fileName} label={attachment.fileName} isOpen={isOpen} onOpenChange={setOpen} />
    </>
  );
}

/** A video that plays in place; its address is only asked for once it comes near the screen. */
function ChatVideo({ attachment }: { attachment: ChatAttachmentDto }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const { data } = useGetChatMediaUrlQuery(seen ? attachment.id : skipToken, { refetchOnMountOrArgChange: 50 * 60 });
  return (
    <div ref={ref} className="max-w-full">
      {data ? (
        <video src={data.url} controls preload="metadata" className="max-h-72 max-w-full rounded-xl bg-black" />
      ) : (
        <Skeleton className="h-40 w-60 max-w-full rounded-xl" />
      )}
    </div>
  );
}

/** A file as a card: icon, name, size; pressing it downloads it. */
export function ChatFileCard({ attachment, mine }: { attachment: ChatAttachmentDto; mine: boolean }) {
  const { t } = useLocale();
  const download = useDownloadChatAttachment();
  return (
    <button
      type="button"
      onClick={() => download(attachment).catch(() => toast.danger(t("common.genericError")))}
      className={`flex w-64 max-w-full items-center gap-3 rounded-xl border px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus ${
        mine ? "border-accent/30 bg-accent/10" : "border-separator bg-surface"
      }`}
    >
      <FileFormatIcon fileName={attachment.fileName} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{attachment.fileName}</span>
        <span className="text-xs text-muted">{formatFileSize(attachment.size)}</span>
      </span>
      <ArrowDownToLine className="size-4 shrink-0 text-muted" aria-label={t("messages.download")} />
    </button>
  );
}

/** The attachments of a message: images in a grid (one alone at its own shape), videos that play in place, files as cards. */
export function ChatAttachments({ attachments, mine }: { attachments: ChatAttachmentDto[]; mine: boolean }) {
  const images = attachments.filter((a) => a.kind === "Image");
  const videos = attachments.filter((a) => a.kind === "Video");
  const files = attachments.filter((a) => a.kind === "Attachment");
  return (
    <div className={`flex max-w-full flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
      {images.length > 0 && (
        <div className={images.length === 1 ? "max-w-full" : `grid w-64 max-w-full gap-1 ${images.length === 2 || images.length === 4 ? "grid-cols-2" : "grid-cols-3"}`}>
          {images.map((image) => <ChatImage key={image.id} attachment={image} single={images.length === 1} />)}
        </div>
      )}
      {videos.map((video) => <ChatVideo key={video.id} attachment={video} />)}
      {files.map((file) => <ChatFileCard key={file.id} attachment={file} mine={mine} />)}
    </div>
  );
}
