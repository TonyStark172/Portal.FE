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
 * browser's Back button (an entry is added to the history while there is something to lose, so Back lands on the page
 * itself and the question opens; "Leave" then really goes back); and navigations made from a handler that go through
 * `runUnlessBlocked` (the account menu's settings and sign-out). Not covered: the browser's Forward button and jumping
 * several entries back at once, and any other code that calls the router directly.
 *
 * The question's "Leave" goes on with what was asked; "Cancel" stays (and re-arms the Back button).
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
    // The entry keeps the router's own state (it needs it when this entry is come back to).
    const arm = () => history.pushState({ ...(history.state ?? {}), [MARKER]: token }, "", location.href);
    const leave = (go: () => void) => () => {
      leaving.current = true;
      setQuestion(null);
      go();
    };
    const ask = (go: () => void, stay?: () => void) => setQuestion({ leave: leave(go), stay });

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
      ask(() => routerRef.current.push(url.pathname + url.search + url.hash));
    };
    const onPop = () => {
      if (leaving.current) return;
      // Back removed the guard's entry, so the page is where it was; the entry is put back once the user has answered.
      ask(() => history.back(), arm);
    };

    arm();
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("popstate", onPop);
    // In the capture phase, before the link's own handler (the router's) sees the click.
    document.addEventListener("click", onClick, true);
    const unblock = setNavigationBlocker((proceed) => {
      ask(proceed);
      return true;
    });
    return () => {
      unblock();
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClick, true);
      // Nothing left to lose: the guard's entry, if it is still the current one, is stepped back from.
      if (!leaving.current && history.state?.[MARKER] === token) history.back();
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
