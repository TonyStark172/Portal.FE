"use client";

import { useState } from "react";
import { toast } from "@heroui/react";
import { useStore } from "react-redux";
import type { PostFileDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { uploadProtected } from "@/shared/api/uploadProtected";
import { useLocale } from "@/shared/i18n";
import type { SessionState } from "@/shared/session/sessionSlice";

export type FileUpload = {
  /** Stable while it uploads: an answer for a file since removed is for nobody. */
  key: string;
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  /** Share uploaded, from 0 to 1. */
  progress: number;
  /** Set once uploaded. */
  file?: PostFileDto;
  source?: File;
};

const toItem = (file: PostFileDto): FileUpload => ({ key: file.id, name: file.fileName, size: file.size, status: "done", progress: 1, file });

/** Files (not pictures or videos) being attached: each uploads at once, reporting its progress, and can be tried again. */
export function useFileUploads(initial: PostFileDto[], onChange: () => void) {
  const { t } = useLocale();
  const store = useStore<{ session: SessionState }>();
  const [items, setItems] = useState<FileUpload[]>(() => initial.map(toItem));

  const update = (key: string, patch: Partial<FileUpload>) =>
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  async function upload(key: string, source: File) {
    update(key, { status: "uploading", progress: 0 });
    const form = new FormData();
    form.append("file", source);
    form.append("kind", "Attachment");
    try {
      const file = await uploadProtected<PostFileDto>(store, "/api/Posts/files", form, {
        onProgress: (progress) => update(key, { progress }),
      });
      update(key, { status: "done", progress: 1, file });
    } catch (error) {
      update(key, { status: "error" });
      toast.danger(toApiProblem(error).detail ?? t("posts.file.uploadFailed").replace("{name}", source.name));
    }
  }

  const start = (sources: File[]) =>
    sources.map((source): FileUpload => ({ key: crypto.randomUUID(), name: source.name, size: source.size, status: "uploading", progress: 0, source }));

  /** Adds files to the list. */
  function add(sources: File[]) {
    const added = start(sources);
    if (added.length === 0) return;
    setItems((list) => [...list, ...added]);
    onChange();
    added.forEach((item) => void upload(item.key, item.source!));
  }

  /** Puts a file in place of the whole list. */
  function replace(source: File) {
    const added = start([source]);
    setItems(added);
    onChange();
    void upload(added[0].key, source);
  }

  function remove(key: string) {
    setItems((list) => list.filter((item) => item.key !== key));
    onChange();
  }

  /** Swaps the list for files already on Portal.BE (or for none); `onChange` is not told. */
  function reset(files: PostFileDto[]) {
    setItems(files.map(toItem));
  }

  function retry(key: string) {
    const item = items.find((i) => i.key === key);
    if (item?.source) void upload(item.key, item.source);
  }

  return {
    items,
    add,
    replace,
    remove,
    reset,
    retry,
    isUploading: items.some((i) => i.status === "uploading"),
    hasFailed: items.some((i) => i.status === "error"),
  };
}
