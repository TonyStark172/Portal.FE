"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

/** Marks the history entry that `open` pushed, so `close` knows it can go back to the page it came from. */
const PUSHED = "commentsPopup";

const idOf = (value: string | null | undefined) => (value && /^\d{1,15}$/.test(value) ? Number(value) : null);

/** The address of the page with the popup's parameters set (a `null` removes it). */
function addressWith(changes: { post: number | null; comment: number | null }) {
  const url = new URL(window.location.href);
  for (const [name, value] of Object.entries(changes)) {
    if (value === null) url.searchParams.delete(name);
    else url.searchParams.set(name, String(value));
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * The comments popup as the address of the page: `?post=123` opens a post's, `&comment=45` points at one comment.
 * The feed does not navigate when it opens (pushState), so it keeps its scroll; the back button closes the popup.
 */
export function useCommentsUrl() {
  const params = useSearchParams();
  const postId = idOf(params?.get("post"));
  const commentId = postId === null ? null : idOf(params?.get("comment"));

  const open = useCallback((id: number) => {
    window.history.pushState({ [PUSHED]: true }, "", addressWith({ post: id, comment: null }));
  }, []);

  // An entry this session pushed is left by going back. One the visit began on (a link) has nothing behind it
  // that is the page, so it is rewritten instead: ✕ never leaves the site.
  const close = useCallback(() => {
    if (window.history.state?.[PUSHED]) window.history.back();
    else window.history.replaceState(window.history.state, "", addressWith({ post: null, comment: null }));
  }, []);

  return { postId, commentId, open, close };
}
