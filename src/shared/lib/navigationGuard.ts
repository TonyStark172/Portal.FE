/**
 * A place for a page with unsaved work to hold back navigation it cannot see: the Next.js router has no hook for that,
 * so the code that navigates from a handler (the account menu: settings, sign out) goes through `runUnlessBlocked`, and
 * the page asks first. Links, the browser's Back button and closing the tab are caught by the page itself.
 */

/** Takes what to do if the user agrees to leave. Returns true when it will ask (so `proceed` is not run now). */
type Blocker = (proceed: () => void) => boolean;

let blocker: Blocker | null = null;

/** Installs the page's blocker; returns the function that removes it (only if it is still the installed one). */
export function setNavigationBlocker(next: Blocker): () => void {
  blocker = next;
  return () => {
    if (blocker === next) blocker = null;
  };
}

/** Runs `proceed` (a navigation, a sign-out) unless a page asked to confirm leaving first; then it runs on a "yes". */
export function runUnlessBlocked(proceed: () => void) {
  if (!blocker?.(proceed)) proceed();
}
