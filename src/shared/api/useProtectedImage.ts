"use client";

import { useEffect, useState } from "react";
import { useSelector, useStore } from "react-redux";
import { backendUrl } from "@/shared/config/backend";
import { selectAccessToken, type SessionState } from "@/shared/session/sessionSlice";

/**
 * Loads an image served by Portal.BE behind authentication (e.g. an avatar) and returns an object URL for <img>.
 * A plain <img src> cannot send the access token, so the image is fetched with it instead.
 * Returns undefined while loading or when there is no image.
 */
export function useProtectedImage(path: string | null | undefined): string | undefined {
  const store = useStore<{ session: SessionState }>();
  const isSignedIn = useSelector(selectAccessToken) !== null;
  const [image, setImage] = useState<{ path: string; url: string }>();

  useEffect(() => {
    if (!path || !isSignedIn) return;

    const controller = new AbortController();
    let objectUrl: string | undefined;
    const token = store.getState().session.accessToken;

    fetch(backendUrl(path), { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setImage({ path, url: objectUrl });
      })
      .catch(() => {
        // No image: callers show a fallback (initials).
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, isSignedIn, store]);

  return image && image.path === path ? image.url : undefined;
}
