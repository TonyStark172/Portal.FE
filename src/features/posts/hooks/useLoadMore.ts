import { useEffect, useState } from "react";

type Paging = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: () => unknown;
};

/**
 * Loads the next page of an infinite query when the end of the list comes into view. Returns a ref callback for an
 * empty element placed after the last item; a list scrolling inside a modal works too.
 */
export function useLoadMore({ hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage }: Paging) {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!sentinel || !hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  return setSentinel;
}
