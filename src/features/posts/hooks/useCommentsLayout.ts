"use client";

import { useCallback, useState } from "react";

export type CommentsLayout = "one" | "two";

const KEY = "portal.comments.layout";

function read(): CommentsLayout {
  try {
    return window.localStorage.getItem(KEY) === "two" ? "two" : "one";
  } catch {
    return "one"; // blocked storage, or the server
  }
}

/** One column or two in the comments popup, remembered on this browser. */
export function useCommentsLayout() {
  const [layout, setLayout] = useState<CommentsLayout>(read);

  const toggle = useCallback(() => {
    const next = layout === "one" ? "two" : "one";
    setLayout(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // The choice holds until the page is closed.
    }
  }, [layout]);

  return { layout, toggle };
}
