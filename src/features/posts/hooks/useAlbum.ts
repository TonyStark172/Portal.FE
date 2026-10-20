"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@heroui/react";
import { useStore } from "react-redux";
import type { PostFileDto, PostMediaDto, PostMediaInput } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { uploadProtected } from "@/shared/api/uploadProtected";
import type { SessionState } from "@/shared/session/sessionSlice";
import { MAX_MEDIA, mediaError, mediaKindOf, type MediaKind } from "../lib/fileRules";

export type AlbumItem = {
  /** Stable while the item moves around (the file id for media already on the post). */
  key: string;
  kind: MediaKind;
  name: string;
  /** Object URL of the picked file, shown at once and while uploading; null for media already on the post. */
  preview: string | null;
  /** Set once uploaded. */
  fileId: string | null;
  caption: string;
  /** Share uploaded, from 0 to 1. */
  progress: number;
  status: "uploading" | "done" | "error";
  source?: File;
};

/**
 * The album being composed: picked images and videos upload at once, side by side, reporting progress; they can be
 * removed, moved and captioned. `onChange` marks the post as edited.
 */
export function useAlbum(initial: PostMediaDto[] | undefined, onChange: () => void) {
  const store = useStore<{ session: SessionState }>();
  const [items, setItems] = useState<AlbumItem[]>(
    () =>
      initial?.map((m) => ({
        key: m.id,
        kind: m.kind === "Video" ? "Video" : "Image",
        name: m.fileName,
        preview: null,
        fileId: m.id,
        caption: m.caption ?? "",
        progress: 1,
        status: "done",
      })) ?? [],
  );

  // Local previews are released with their item, and all of them when the composer closes.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach(URL.revokeObjectURL);
  }, []);

  const update = (key: string, patch: Partial<AlbumItem>) =>
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  async function upload(key: string, source: File, kind: MediaKind) {
    update(key, { status: "uploading", progress: 0 });
    const form = new FormData();
    form.append("file", source);
    form.append("kind", kind);
    try {
      const file = await uploadProtected<PostFileDto>(store, "/api/Posts/files", form, {
        onProgress: (progress) => update(key, { progress }),
      });
      update(key, { status: "done", fileId: file.id, progress: 1 });
    } catch (error) {
      update(key, { status: "error" });
      toast.danger(toApiProblem(error).detail ?? `Không tải được "${source.name}".`);
    }
  }

  function add(files: File[]) {
    const accepted = files.filter((file) => {
      const error = mediaError(file);
      if (error) toast.danger(error);
      return !error;
    });
    const room = Math.max(MAX_MEDIA - items.length, 0);
    if (accepted.length > room) toast.danger(`Tối đa ${MAX_MEDIA} ảnh và video mỗi bài.`);

    const added = accepted.slice(0, room).map((source): AlbumItem => {
      const preview = URL.createObjectURL(source);
      previews.current.add(preview);
      return {
        key: crypto.randomUUID(),
        kind: mediaKindOf(source)!,
        name: source.name,
        preview,
        fileId: null,
        caption: "",
        progress: 0,
        status: "uploading",
        source,
      };
    });
    if (added.length === 0) return;

    setItems((list) => [...list, ...added]);
    onChange();
    added.forEach((item) => void upload(item.key, item.source!, item.kind));
  }

  function release(item: AlbumItem) {
    if (!item.preview) return;
    URL.revokeObjectURL(item.preview);
    previews.current.delete(item.preview);
  }

  function remove(key: string) {
    const item = items.find((i) => i.key === key);
    if (item) release(item);
    setItems((list) => list.filter((i) => i.key !== key));
    onChange();
  }

  function clear() {
    items.forEach(release);
    setItems([]);
    onChange();
  }

  function move(from: number, to: number) {
    setItems((list) => {
      const next = [...list];
      next.splice(to, 0, ...next.splice(from, 1));
      return next;
    });
    onChange();
  }

  function setCaption(key: string, caption: string) {
    update(key, { caption });
    onChange();
  }

  function retry(key: string) {
    const item = items.find((i) => i.key === key);
    if (item?.source) void upload(item.key, item.source, item.kind);
  }

  /** The album as Portal.BE takes it: uploaded items in order, with their captions. */
  const toInput = (): PostMediaInput[] =>
    items
      .filter((i) => i.status === "done" && i.fileId)
      .map((i) => ({ id: i.fileId!, caption: i.caption.trim() || null }));

  return {
    items,
    add,
    remove,
    clear,
    move,
    setCaption,
    retry,
    toInput,
    isUploading: items.some((i) => i.status === "uploading"),
    hasFailed: items.some((i) => i.status === "error"),
    hasMedia: items.some((i) => i.status === "done"),
  };
}

export type Album = ReturnType<typeof useAlbum>;
