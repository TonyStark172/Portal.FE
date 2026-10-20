"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * A post's text. The HTML was sanitized by Portal.BE (formatting, mentions and tables), so it is rendered as is;
 * images and videos are the album (PostMedia). Each table gets a wrapper that scrolls sideways, so a table wider
 * than the post keeps its column widths instead of overflowing the card or being squeezed.
 */
export function PostContent({ html }: { html: string }) {
  const container = useRef<HTMLDivElement>(null);

  // Runs again whenever React puts new HTML in (the wrappers go with the old HTML).
  useLayoutEffect(() => {
    container.current?.querySelectorAll("table").forEach((table) => {
      if (table.parentElement?.classList.contains("post-table")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "post-table";
      table.replaceWith(wrapper);
      wrapper.append(table);
    });
  }, [html]);

  return <div ref={container} className="post-content text-foreground" dangerouslySetInnerHTML={{ __html: html }} />;
}
