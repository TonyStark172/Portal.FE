"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Page<T> = { items: T[]; hasMore: boolean };
type Session<T> = { controller: AbortController; busy: boolean; hasMore: boolean; failed: boolean; page: number; load: (page: number, signal: AbortSignal) => Promise<Page<T>> };

/** One search owns its pages. A new search aborts the previous session, including membership checks. */
export function usePagedAudienceSuggestions<T extends { key: string }>(enabled: boolean, loadPage: (page: number, signal: AbortSignal) => Promise<Page<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<typeof loadPage | null>(null);
  const session = useRef<Session<T> | null>(null);

  const request = useCallback(async (current: Session<T>, retry = false) => {
    if (current.busy || current.controller.signal.aborted || current.failed && !retry || current.page > 1 && !current.hasMore) return;
    current.busy = true;
    current.failed = false;
    setLoading(true);
    setError(null);
    try {
      const result = await current.load(current.page, current.controller.signal);
      if (current.controller.signal.aborted) return;
      // The sentinel can fire before React commits the new hasMore/error state.
      current.hasMore = result.hasMore;
      setItems(previous => [...new Map([...previous, ...result.items].map(item => [item.key, item])).values()]);
      setHasMore(result.hasMore);
      current.page++;
    } catch (e) {
      current.failed = true;
      if (!current.controller.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được danh sách.");
    } finally {
      current.busy = false;
      if (!current.controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const current: Session<T> = { controller: new AbortController(), busy: false, hasMore: false, failed: false, page: 1, load: loadPage };
    session.current = current;
    // Defer the reset outside the effect body; cleanup invalidates even fetchers that ignore abort.
    const reset = setTimeout(() => {
      setItems([]);
      setError(null);
      setHasMore(false);
      setLoading(enabled);
      setOwner(() => loadPage);
    }, 0);
    const timer = enabled ? setTimeout(() => void request(current), 200) : undefined;
    return () => { clearTimeout(reset); clearTimeout(timer); current.controller.abort(); };
  }, [enabled, loadPage, request]);

  const loadMore = useCallback(() => {
    if (enabled && owner === loadPage && hasMore && !error && session.current?.load === loadPage && session.current.page > 1) void request(session.current);
  }, [enabled, owner, loadPage, hasMore, error, request]);
  const retry = useCallback(() => {
    if (enabled && session.current?.load === loadPage) void request(session.current, true);
  }, [enabled, loadPage, request]);

  const current = enabled && owner === loadPage;
  return { items: current ? items : [], loading: enabled && (!current || loading), hasMore: current && hasMore, error: current ? error : null, loadMore, retry };
}
