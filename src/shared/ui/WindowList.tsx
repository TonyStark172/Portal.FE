"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

type WindowListProps<T> = {
  items: T[];
  getKey: (item: T) => string | number;
  renderItem: (item: T) => ReactNode;
  /** Space between two items, in px. */
  gap?: number;
  /** Height guessed for an item not rendered yet, in px; each one is measured once it renders. */
  estimateSize?: number;
};

/**
 * A long list scrolling with the page that keeps only the items near the viewport in the DOM, so it stays as fast
 * after thousands of items as after ten. Items may be of any height: each is measured as it renders, and the list
 * keeps the height of all of them, so the page's scrollbar still shows the whole list.
 */
export function WindowList<T>({ items, getKey, renderItem, gap = 0, estimateSize = 320 }: WindowListProps<T>) {
  const list = useRef<HTMLDivElement>(null);
  // Where the list starts on the page: what is above it (a composer opening, pinned posts loading) moves it.
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const element = list.current;
    const above = element?.parentElement;
    if (!element || !above) return;

    const measure = () => setOffset(element.getBoundingClientRect().top + window.scrollY);
    const observer = new ResizeObserver(measure);
    observer.observe(above);
    return () => observer.disconnect();
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize,
    gap,
    overscan: 3,
    scrollMargin: offset,
    getItemKey: (index) => getKey(items[index]),
    // Rendered on React's schedule rather than synchronously inside the ResizeObserver measuring the items, which
    // changes the layout in the same frame and makes the browser report a ResizeObserver loop.
    useFlushSync: false,
  });

  return (
    <div ref={list} style={{ position: "relative", height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          ref={virtualizer.measureElement}
          style={{
            position: "absolute",
            insetInline: 0,
            top: 0,
            transform: `translateY(${row.start - offset}px)`,
          }}
        >
          {renderItem(items[row.index])}
        </div>
      ))}
    </div>
  );
}
