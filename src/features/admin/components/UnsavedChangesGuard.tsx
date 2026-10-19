"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/shared/i18n";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * Asks before unsaved work is lost, while `when` is true: the browser asks before the tab is closed, reloaded or sent
 * elsewhere (`beforeunload`), and a click on a link inside the app (the admin tabs, the menu) first opens a question —
 * "Leave" goes on to the link, "Cancel" stays. The Next.js router has no hook to hold a navigation back, so the click is
 * caught before it reaches the link. (The browser's Back button is not caught.)
 */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const { t } = useLocale();
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!when) return;
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
      setTarget(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", onUnload);
    // In the capture phase, before the link's own handler (the router's) sees the click.
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [when]);

  if (!target) return null;
  return (
    <ConfirmDialog
      title={t("roles.leaveTitle")}
      message={t("roles.leaveMessage")}
      confirmLabel={t("roles.leave")}
      danger
      isPending={false}
      onConfirm={() => {
        const href = target;
        setTarget(null);
        router.push(href);
      }}
      onClose={() => setTarget(null)}
    />
  );
}
