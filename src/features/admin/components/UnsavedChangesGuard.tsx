"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/shared/i18n";
import { setNavigationBlocker } from "@/shared/lib/navigationGuard";
import { ConfirmDialog } from "./ConfirmDialog";

/** What to do on "Leave", and (for the Back button) what to do on "Cancel" to be guarded again. */
type Question = { leave: () => void; stay?: () => void };

/** The marker the guard puts in the state of the history entry it adds. */
const MARKER = "__unsavedGuard";

/**
 * Asks before unsaved work is lost, while `when` is true. Covers: closing, reloading or sending the tab elsewhere
 * (`beforeunload`); a click on a link inside the app (the admin tabs, the menu), caught before it reaches the link; the
 * browser's Back button; and navigations made from a handler that go through `runUnlessBlocked` (the account menu's
 * settings and sign-out). Not covered: the browser's Forward button and jumping several entries back at once (the page is
 * then left without a question), and any other code that calls the router directly.
 *
 * Back works through a sentinel: while there is something to lose, an entry for this same page is added to the history
 * (history is [.., page, sentinel]), so Back lands on the page itself and the question opens. The sentinel is kept clean:
 *  - "Cancel" adds it again (never a second one while it is there); "Leave" from Back goes on back for real;
 *  - "Leave" from a link or the menu first steps off the sentinel (a Back, whose popstate is awaited and ignored) and then
 *    navigates, so no stray copy of this page is left in the history;
 *  - once nothing is unsaved (saved, reset) the sentinel is stepped back from too;
 *  - while it is there `history.scrollRestoration` is "manual", so those steps do not make the browser restore an old scroll
 *    position; the previous value is put back when the guard lets go;
 *  - a popstate counts as Back only when it leaves the sentinel for this page's own URL (not one that lands on the sentinel,
 *    as Forward does, nor a change of the hash).
 * Known limit: if the router replaces the history state while the sentinel is current, the marker is lost; the Back question
 * still opens, but the sentinel is then not stepped back from after a save (one extra entry stays).
 */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const { t } = useLocale();
  const router = useRouter();
  const [question, setQuestion] = useState<Question | null>(null);
  // Set once the user has agreed to leave: the guard must not ask again, nor undo its history entry, on the way out.
  const leaving = useRef(false);
  // The router can be a new object on every render; the guard (an effect that adds a history entry) must not restart for that.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  });

  useEffect(() => {
    if (!when) return;
    leaving.current = false;
    const token = Math.random().toString(36).slice(2);
    const here = location.pathname + location.search;
    const hash = location.hash;
    // Whether the current entry is the sentinel (kept as a flag, as the router may replace the entry's state).
    let atSentinel = false;
    const previousMode = history.scrollRestoration;
    let manual = false;
    const setMode = (mode: ScrollRestoration) => {
      try {
        history.scrollRestoration = mode;
      } catch {
        // Not supported: the browser's own restoration stays.
      }
    };
    const restoreMode = () => {
      if (manual) setMode(previousMode);
      manual = false;
    };

    const arm = () => {
      if (atSentinel && history.state?.[MARKER] === token) return;
      if (!manual) {
        setMode("manual");
        manual = true;
      }
      // The entry keeps the router's own state (it needs it when this entry is come back to).
      history.pushState({ ...(history.state ?? {}), [MARKER]: token }, "", location.href);
      setMode("manual");
      atSentinel = true;
    };
    /** Steps off the sentinel (if on it), waits for that to be done, then goes on with `then`. */
    const stepOff = (then: () => void) => {
      if (!atSentinel) {
        restoreMode();
        then();
        return;
      }
      atSentinel = false;
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        window.removeEventListener("popstate", go);
        restoreMode();
        then();
      };
      window.addEventListener("popstate", go);
      // A popstate always follows; if some browser does not send one, the navigation still goes on.
      window.setTimeout(go, 500);
      history.back();
    };

    const ask = (go: () => void, stay?: () => void) =>
      setQuestion({
        leave: () => {
          leaving.current = true;
          setQuestion(null);
          go();
        },
        stay,
      });

    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers need a value; none shows their own text.
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link || link.hasAttribute("download") || (link.getAttribute("target") ?? "_self") !== "_self") return;
      const url = new URL((link as HTMLAnchorElement).href, location.href);
      // Another site, or a place on this very page, is not a way out of the page this guards.
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      event.preventDefault();
      event.stopPropagation();
      ask(() => stepOff(() => routerRef.current.push(url.pathname + url.search + url.hash)));
    };
    const onPop = () => {
      if (leaving.current) return;
      // Landed on the sentinel (Forward): still guarded, nothing to ask.
      if (history.state?.[MARKER] === token) {
        atSentinel = true;
        return;
      }
      const wasAtSentinel = atSentinel;
      atSentinel = false;
      // Only Back from the sentinel to this very page is a question; a hash change or another place is not.
      if (!wasAtSentinel || location.pathname + location.search !== here || location.hash !== hash) return;
      ask(() => {
        restoreMode();
        history.back();
      }, arm);
    };

    arm();
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("popstate", onPop);
    // In the capture phase, before the link's own handler (the router's) sees the click.
    document.addEventListener("click", onClick, true);
    const unblock = setNavigationBlocker((proceed) => {
      ask(() => stepOff(proceed));
      return true;
    });
    return () => {
      unblock();
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClick, true);
      if (!leaving.current && atSentinel && history.state?.[MARKER] === token) {
        // Nothing left to lose: step back from the sentinel (the mode is put back once that is done).
        window.addEventListener("popstate", restoreMode, { once: true });
        history.back();
      } else if (!leaving.current) {
        restoreMode();
      }
    };
  }, [when]);

  if (!question) return null;
  return (
    <ConfirmDialog
      title={t("roles.leaveTitle")}
      message={t("roles.leaveMessage")}
      confirmLabel={t("roles.leave")}
      danger
      isPending={false}
      onConfirm={question.leave}
      onClose={() => {
        setQuestion(null);
        question.stay?.();
      }}
    />
  );
}
