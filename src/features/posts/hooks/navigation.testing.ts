import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const restores: (() => void)[] = [];
const notify = () => listeners.forEach((listener) => listener());

/**
 * `next/navigation` for a test with no router: useSearchParams follows the address of the page, as Next's does
 * (which syncs with pushState, replaceState and the back button).
 */
export const historyNavigation = {
  useSearchParams: () => {
    const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
    return new URLSearchParams(search);
  },
};

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    window.addEventListener("popstate", notify);
    for (const method of ["pushState", "replaceState"] as const) {
      const original = window.history[method];
      window.history[method] = function (...args: Parameters<History["pushState"]>) {
        original.apply(this, args);
        notify();
      };
      restores.push(() => (window.history[method] = original));
    }
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("popstate", notify);
      restores.splice(0).forEach((restore) => restore());
    }
  };
}
