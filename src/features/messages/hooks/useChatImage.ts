"use client";

import { useCallback, useEffect, useState } from "react";
import { useStore } from "react-redux";
import { fetchProtected } from "@/shared/api/fetchProtected";
import { useLogin } from "@/shared/session/login";
import type { SessionState } from "@/shared/session/sessionSlice";
import { acquireImage, peekImage, releaseImage } from "../lib/imageCache";

/**
 * Whether an element has come near the screen yet (and then stays "seen"): what is far down a long list or grid is not
 * loaded until it is about to be looked at. Returns a ref for the element and the answer.
 */
export function useSeen<T extends Element>(rootMargin = "400px"): [(node: T | null) => void, boolean] {
  const [node, setNode] = useState<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (!node || seen) return;
    const observer = new IntersectionObserver(
      (observed) => {
        if (observed.some((entry) => entry.isIntersecting)) setSeen(true);
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, seen, rootMargin]);

  return [useCallback((element: T | null) => setNode(element), []), seen];
}

/**
 * An image of a conversation (it needs the access token, so a plain <img src> cannot load it) as an object URL, shared
 * through the page's image cache; undefined until it is there. Nothing is downloaded while `enabled` is false.
 */
export function useChatImage(path: string | null | undefined, enabled = true): string | undefined {
  const store = useStore<{ session: SessionState }>();
  const login = useLogin();
  const [loaded, setLoaded] = useState<{ path: string; url: string }>();

  useEffect(() => {
    if (!path || !enabled || login === null) return;
    let active = true;
    acquireImage(login, path, () =>
      fetchProtected(store, path).then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status))))),
    ).then(
      (url) => {
        if (active) setLoaded({ path, url });
      },
      () => {
        // No image: the placeholder stays.
      },
    );
    return () => {
      active = false;
      releaseImage(login, path);
    };
  }, [path, enabled, login, store]);

  if (!path || login === null) return undefined;
  // Downloaded before (by another bubble, the grid…): there at the first render, without a flash of placeholder.
  return loaded?.path === path ? loaded.url : enabled ? peekImage(login, path) : undefined;
}
