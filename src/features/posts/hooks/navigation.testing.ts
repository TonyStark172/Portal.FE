import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const restores: (() => void)[] = [];
/** The address as the router knows it, once something is subscribed; before that, the page's own. */
let known: string | null = null;
const notify = () => {
  known = window.location.search;
  listeners.forEach((listener) => listener());
};

/**
 * `next/navigation` for a test with no router: useSearchParams follows the address of the page, as Next's does
 * (which syncs with pushState, replaceState and the back button, but takes a call whose state has `__NA` or `_N` for
 * one of its own, and leaves itself as it was).
 */
export const historyNavigation = {
  useSearchParams: () => {
    const search = useSyncExternalStore(subscribe, () => known ?? window.location.search, () => "");
    return new URLSearchParams(search);
  },
};

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    known = window.location.search;
    window.addEventListener("popstate", notify);
    for (const method of ["pushState", "replaceState"] as const) {
      const original = window.history[method];
      window.history[method] = function (...args: Parameters<History["pushState"]>) {
        original.apply(this, args);
        if (!args[0]?.__NA && !args[0]?._N) notify();
      };
      restores.push(() => (window.history[method] = original));
    }
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      known = null;
      window.removeEventListener("popstate", notify);
      restores.splice(0).forEach((restore) => restore());
    }
  };
}
