"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Modal, Skeleton, Tabs, toast } from "@heroui/react";
import { Comment, Globe, PlayFill } from "@gravity-ui/icons";
import { FileFormatIcon, formatFileSize } from "@/features/posts/components/AttachmentList";
import { useLoadMore } from "@/features/posts/hooks/useLoadMore";
import type {
  ChatAttachmentDto,
  ConversationDto,
  SharedChatContentKind,
  SharedChatItemDto,
  SharedChatItemPage,
} from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { useHubSignal } from "@/shared/realtime/hub";
import { ImagePreviewModal } from "@/shared/ui/ImagePreviewModal";
import { skipToken } from "@reduxjs/toolkit/query";
import { chatAttachmentPath, useGetChatMediaUrlQuery, useGetSharedChatContentPagesInfiniteQuery } from "../api";
import { useChatImage, useSeen } from "../hooks/useChatImage";
import { listTime } from "../lib/messageTime";
import { memberName } from "../lib/messageText";
import { useChatThumbnail, useDownloadChatAttachment } from "./ChatAttachments";
import { PanelFrame } from "./ConversationSidePanels";

export type SharedTab = "media" | "files" | "links";

const TABS: { id: SharedTab; kind: SharedChatContentKind; label: string; empty: string }[] = [
  { id: "media", kind: "Media", label: "messages.sharedMedia", empty: "messages.noSharedMedia" },
  { id: "files", kind: "Files", label: "messages.sharedFiles", empty: "messages.noSharedFiles" },
  { id: "links", kind: "Links", label: "messages.sharedLinks", empty: "messages.noSharedLinks" },
];

/** The items of the pages read so far, each once (a page read again may overlap the next). */
function distinctItems(pages: SharedChatItemPage[] | undefined): SharedChatItemDto[] {
  const seen = new Set<string>();
  const items: SharedChatItemDto[] = [];
  for (const item of (pages ?? []).flatMap((page) => page.items)) {
    const key = `${item.messageId}:${item.attachment?.id ?? item.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

/** The site of a link ("example.com"), or the link itself when it cannot be read as one. */
function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * What was shared in a conversation, as on Messenger: photos and videos in a grid, files and links in lists, newest
 * first and more on the way down; each one can be shown where it was sent in the conversation.
 */
export function SharedContentPanel({ conversation, myId, tab, onTab, onJumpTo, onBack, onClose }: {
  conversation: ConversationDto;
  myId: number | undefined;
  tab: SharedTab;
  onTab: (tab: SharedTab) => void;
  onJumpTo: (messageId: number) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  return (
    <PanelFrame title={t("messages.sharedTitle")} onBack={onBack} onClose={onClose} bodyClassName="flex flex-col">
      <Tabs selectedKey={tab} onSelectionChange={(key) => onTab(key as SharedTab)} className="flex min-h-0 flex-1 flex-col">
        <Tabs.ListContainer className="px-3 pt-3">
          <Tabs.List aria-label={t("messages.sharedTitle")} className="w-full">
            {TABS.map((item) => (
              <Tabs.Tab key={item.id} id={item.id} className="flex-1">
                {t(item.label)}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {TABS.map((item) => (
          <Tabs.Panel key={item.id} id={item.id} className="min-h-0 flex-1 overflow-y-auto scrollbar p-3">
            <SharedList conversation={conversation} myId={myId} kind={item.kind} empty={t(item.empty)} onJumpTo={onJumpTo} />
          </Tabs.Panel>
        ))}
      </Tabs>
    </PanelFrame>
  );
}

function SharedList({ conversation, myId, kind, empty, onJumpTo }: {
  conversation: ConversationDto;
  myId: number | undefined;
  kind: SharedChatContentKind;
  empty: string;
  onJumpTo: (messageId: number) => void;
}) {
  const { t, locale } = useLocale();
  // Read afresh each time the tab is opened.
  const { currentData, isError, refetch, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } =
    useGetSharedChatContentPagesInfiniteQuery({ conversationId: conversation.id, kind }, { refetchOnMountOrArgChange: true });
  // A message came or changed while it is open: read again, unless the reader has gone further down the list (reading
  // again starts from the first page, which would take what they are looking at away).
  const pagesLoaded = currentData?.pages.length ?? 0;
  useHubSignal((signal) => {
    if (signal.kind === "Messages" && signal.conversationId === conversation.id && signal.messageId != null && pagesLoaded <= 1) void refetch();
  });
  const sentinel = useLoadMore({ hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, rootMargin: "200px" });
  const items = useMemo(() => distinctItems(currentData?.pages), [currentData]);

  if (!currentData) {
    return isError ? (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t("messages.sharedLoadError")}</Alert.Title>
        </Alert.Content>
        <Button size="sm" variant="secondary" onPress={() => void refetch()}>{t("common.retry")}</Button>
      </Alert>
    ) : (
      <SharedSkeleton kind={kind} count={kind === "Media" ? 9 : 6} label={t("messages.sharedLoading")} />
    );
  }
  if (items.length === 0) return <p className="p-4 text-center text-sm text-muted">{empty}</p>;

  const byline = (item: SharedChatItemDto) =>
    `${memberName(item.senderId, conversation.members, myId, t)} · ${listTime(item.sentAt, locale)}`;

  return (
    <>
      {kind === "Media" ? (
        <ul className="grid grid-cols-3 gap-1">
          {items.map((item) => (
            <li key={`${item.messageId}:${item.attachment!.id}`}>
              {item.attachment!.kind === "Video" ? (
                <VideoTile attachment={item.attachment!} onShowInChat={() => onJumpTo(item.messageId)} />
              ) : (
                <ImageTile attachment={item.attachment!} onShowInChat={() => onJumpTo(item.messageId)} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((item) =>
            kind === "Files" ? (
              <FileRow key={`${item.messageId}:${item.attachment!.id}`} attachment={item.attachment!} byline={byline(item)} onShowInChat={() => onJumpTo(item.messageId)} />
            ) : (
              <LinkRow key={`${item.messageId}:${item.url}`} url={item.url!} byline={byline(item)} onShowInChat={() => onJumpTo(item.messageId)} />
            ),
          )}
        </ul>
      )}
      {/* While more remain the list ends in placeholders; reaching them reads the next page. */}
      {hasNextPage && !isFetchNextPageError && (
        <div ref={sentinel} className="pt-1">
          <SharedSkeleton kind={kind} count={3} label={t("messages.sharedLoading")} />
        </div>
      )}
      {isFetchNextPageError && !isFetchingNextPage && (
        <div className="flex items-center justify-center gap-3 py-2 text-sm text-muted">
          {t("messages.sharedLoadError")}
          <Button size="sm" variant="secondary" onPress={() => void fetchNextPage()}>{t("common.retry")}</Button>
        </div>
      )}
    </>
  );
}

/** What stands in for the tiles or rows on their way: the same shapes, so nothing jumps when they come. */
function SharedSkeleton({ kind, count, label }: { kind: SharedChatContentKind; count: number; label: string }) {
  return kind === "Media" ? (
    <div role="status" aria-label={label} className="grid grid-cols-3 gap-1">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
    </div>
  ) : (
    <div role="status" aria-label={label} className="flex flex-col gap-0.5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-1.5">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-3/5 rounded-full" />
            <Skeleton className="h-3 w-2/5 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The corner button of a tile that shows it in the conversation (always there on touch screens). */
function TileShowInChat({ onPress }: { onPress: () => void }) {
  const { t } = useLocale();
  return (
    <button
      type="button"
      aria-label={t("messages.showInChat")}
      title={t("messages.showInChat")}
      onClick={onPress}
      className="absolute end-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/55 text-white opacity-0 outline-none transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus [@media(hover:none)]:opacity-100"
    >
      <Comment className="size-3.5" />
    </button>
  );
}

/**
 * An image of the grid: its smaller copy, downloaded once the tile comes near the screen, over a placeholder; the image
 * itself only when it is opened.
 */
function ImageTile({ attachment, onShowInChat }: { attachment: ChatAttachmentDto; onShowInChat: () => void }) {
  const { t } = useLocale();
  const [ref, seen] = useSeen<HTMLDivElement>();
  const thumbnail = useChatThumbnail(attachment, seen);
  const [shown, setShown] = useState(false);
  const [isOpen, setOpen] = useState(false);
  const original = useChatImage(chatAttachmentPath(attachment.id), isOpen);
  return (
    <div ref={ref} className="group relative aspect-square overflow-hidden rounded-lg bg-default">
      {!shown && <Skeleton aria-hidden className="absolute inset-0 rounded-none" />}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("messages.openImage").replace("{name}", attachment.fileName)}
        className="relative flex size-full items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
      >
        {thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element -- an object URL of an authenticated download
          <img
            src={thumbnail}
            alt=""
            decoding="async"
            onLoad={() => setShown(true)}
            className={`size-full object-cover transition-opacity duration-200 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
          />
        )}
      </button>
      <TileShowInChat onPress={onShowInChat} />
      <ImagePreviewModal src={original ?? thumbnail} alt={attachment.fileName} label={attachment.fileName} isOpen={isOpen} onOpenChange={setOpen} />
    </div>
  );
}

function VideoTile({ attachment, onShowInChat }: { attachment: ChatAttachmentDto; onShowInChat: () => void }) {
  const { t } = useLocale();
  const [ref, seen] = useSeen<HTMLDivElement>();
  // Its address, and with it its first frame, are only asked for once the tile comes near the screen.
  const { data } = useGetChatMediaUrlQuery(seen ? attachment.id : skipToken, { refetchOnMountOrArgChange: 50 * 60 });
  const [isOpen, setOpen] = useState(false);
  return (
    <div ref={ref} className="group relative aspect-square overflow-hidden rounded-lg bg-default">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("messages.playVideo").replace("{name}", attachment.fileName)}
        className="relative flex size-full items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
      >
        {/* #t=0.1 makes the browser draw a first frame as the thumbnail. */}
        {data ? <video src={`${data.url}#t=0.1`} preload="metadata" muted playsInline className="pointer-events-none size-full object-cover" /> : <Skeleton aria-hidden className="absolute inset-0 rounded-none" />}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-8 items-center justify-center rounded-full bg-black/55 text-white">
            <PlayFill className="size-4" />
          </span>
        </span>
      </button>
      <TileShowInChat onPress={onShowInChat} />
      <Modal.Backdrop isOpen={isOpen} onOpenChange={setOpen} variant="blur">
        <Modal.Container placement="center">
          <Modal.Dialog aria-label={attachment.fileName} className="w-[min(720px,calc(100vw-2rem))] max-w-none bg-transparent p-0 shadow-none">
            <Modal.CloseTrigger aria-label={t("common.close")} />
            {data && <video src={data.url} controls autoPlay className="max-h-[80dvh] w-full rounded-xl bg-black" />}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}

function ShowInChatButton({ onPress }: { onPress: () => void }) {
  const { t } = useLocale();
  return (
    <Button isIconOnly size="sm" variant="ghost" aria-label={t("messages.showInChat")} className="shrink-0 text-muted" onPress={onPress}>
      <Comment className="size-4" />
    </Button>
  );
}

function FileRow({ attachment, byline, onShowInChat }: { attachment: ChatAttachmentDto; byline: string; onShowInChat: () => void }) {
  const { t } = useLocale();
  const download = useDownloadChatAttachment();
  return (
    <li className="flex items-center gap-1 rounded-xl p-1.5 hover:bg-default">
      <button
        type="button"
        onClick={() => download(attachment).catch(() => toast.danger(t("common.genericError")))}
        className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <FileFormatIcon fileName={attachment.fileName} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{attachment.fileName}</span>
          <span className="truncate text-xs text-muted">{formatFileSize(attachment.size)} · {byline}</span>
        </span>
      </button>
      <ShowInChatButton onPress={onShowInChat} />
    </li>
  );
}

function LinkRow({ url, byline, onShowInChat }: { url: string; byline: string; onShowInChat: () => void }) {
  return (
    <li className="flex items-center gap-1 rounded-xl p-1.5 hover:bg-default">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-default text-muted">
          <Globe className="size-5" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{siteOf(url)}</span>
          <span className="truncate text-xs text-accent">{url}</span>
          <span className="truncate text-xs text-muted">{byline}</span>
        </span>
      </a>
      <ShowInChatButton onPress={onShowInChat} />
    </li>
  );
}
