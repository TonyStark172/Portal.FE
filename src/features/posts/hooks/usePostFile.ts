"use client";

import { useCallback } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { useStore } from "react-redux";
import { fetchProtected } from "@/shared/api/fetchProtected";
import { useProtectedImage } from "@/shared/api/useProtectedImage";
import type { SessionState } from "@/shared/session/sessionSlice";
import { useGetMediaUrlQuery } from "../api";

export const postFileUrl = (id: string) => `/api/Posts/files/${id}`;

/** Object URL of a post image (fetched with the access token), or undefined while loading. */
export function usePostImage(fileId: string | null | undefined): string | undefined {
  return useProtectedImage(fileId ? postFileUrl(fileId) : null);
}

/**
 * Address of an album image or video on the storage (a presigned URL), which <img> and <video> load directly, and
 * <video> can seek in. Undefined while loading.
 */
export function useMediaUrl(fileId: string | null | undefined): string | undefined {
  const { data } = useGetMediaUrlQuery(fileId ?? skipToken, { refetchOnMountOrArgChange: 50 * 60 });
  return data?.url;
}

/** Downloads a post attachment under its original name (a plain link could not send the access token). */
export function useDownloadPostFile() {
  const store = useStore<{ session: SessionState }>();

  return useCallback(
    async (id: string, fileName: string) => {
      const response = await fetchProtected(store, postFileUrl(id));
      if (!response.ok) throw new Error(String(response.status));

      const url = URL.createObjectURL(await response.blob());
      const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    [store],
  );
}
