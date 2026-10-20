"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LayoutGroup, MotionConfig, animate, motion, stagger } from "motion/react";
import { Card } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { useGetMyProfileQuery } from "@/shared/api/generated/portalApi";
import { usePhone } from "@/shared/hooks/usePhone";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { useLocale } from "@/shared/i18n";
import { ComposerPrompt } from "./ComposerPrompt";
import { PostComposer } from "./PostComposer";

/** The spring everything of the new-post box moves on (as Motion's iOS app folder example): quick, without a bounce. */
const SPRING = { type: "spring", stiffness: 200, damping: 22 } as const;
/** Long enough for the closing to be over, before a posted or discarded draft is made afresh. */
const SHOW_MS = 700;

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (notify: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
/** Whether the viewer asked for less motion; read here, so the box obeys whatever the stylesheet does. */
const useReducedMotion = () => useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);

/** React Aria's popovers and menus (`data-trigger`) and the @ list (a top layer), all rendered on the body. */
const OVERLAYS = "[data-trigger], [data-react-aria-top-layer]";

/**
 * Closes the popups the composer opened, which live outside it (on the body) and would stay behind: each popover takes
 * an Escape, and leaving the editor ends the @ list.
 */
function closePopups(inside: HTMLElement | null) {
  for (const popup of document.querySelectorAll<HTMLElement>("[data-trigger]")) {
    popup.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  }
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && (inside?.contains(focused) || focused.closest(OVERLAYS))) focused.blur();
}

/**
 * The composer's parts rise in one after another as it opens (Web Animations, so off the main thread where it can).
 * Meanwhile the composer does not scroll: the parts still below their place would show a scrollbar for a moment.
 */
function bringInParts(composer: HTMLElement | null) {
  const parts = composer?.querySelectorAll<HTMLElement>("[data-composer-parts] > *");
  if (!composer || !parts?.length) return;
  composer.setAttribute("data-entering", "");
  // The whole transform (not y, which Motion runs through a CSS variable the compositor cannot take).
  void animate(parts, { opacity: [0, 1], transform: ["translateY(6px)", "none"] }, { duration: 0.3, ease: [0.2, 0, 0, 1], delay: stagger(0.04, { startDelay: 0.08 }) })
    .finished.then(() => composer.removeAttribute("data-entering"));
}

/**
 * The new-post box, animated: loaded (with the animation library) only once the box is wanted, pointed at, focused or
 * pressed (the feed shows a plain one until then, NewPostBox). Pinned under the top bar as the posts scroll, on a band
 * of the page's colour that hides them in the gap above it and beside its top corners. The composer is made as it
 * comes, and kept with its draft; opening it is only an animation, on a spring, moving nothing but itself:
 * - wider than a phone, the box itself opens into the composer, as Motion's iOS app folder does: the one card grows
 *   from where it is (a layout animation, by transform, its content counter-scaled and revealed as it grows), the
 *   avatar flies from the box into the composer's head, the box's line fades and the composer's parts rise in, over a
 *   dim backdrop; it shrinks back into the box to close, as soon as the posts are scrolled (by a wheel or a swipe
 *   outside it, not when the page moves by itself, as when a phone's keyboard opens), on Escape or on the backdrop;
 * - on a phone the composer slides up full screen.
 * Closing takes its popups with it and keeps what was written; posting or discarding it starts afresh.
 */
export default function PinnedComposer({ openAtStart }: { openAtStart: boolean }) {
  const { t } = useLocale();
  const phone = usePhone();
  const reduced = useReducedMotion();
  const { user } = useCurrentUser();
  const { data: profile } = useGetMyProfileQuery(undefined, { skip: !user });
  const [isOpen, setOpen] = useState(false);
  // The box was wanted: the composer is made at once.
  const [isReady, setReady] = useState(true);
  const [hasDraft, setDraft] = useState(false);
  const [round, setRound] = useState(0);
  const band = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const reset = useRef<number | undefined>(undefined);
  // The avatar's flight is this box's own: another feed (one shown before) never lends it a starting point.
  const group = useId();

  // Pressed before this module had come: open now that the composer is made (a frame later, so it opens from the box).
  useEffect(() => {
    if (!openAtStart) return;
    const frame = window.requestAnimationFrame(() => setOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, [openAtStart]);
  useEffect(() => () => window.clearTimeout(reset.current), []);
  // Opening: the parts rise in, and the focus goes into the composer, without scrolling the page to it.
  useEffect(() => {
    if (!isOpen) return;
    if (!reduced) bringInParts(sheet.current);
    sheet.current?.querySelector<HTMLElement>("input, [contenteditable=true]")?.focus({ preventScroll: true });
  }, [isOpen, reduced]);
  // Wider, the band's light gap under the top bar goes with the backdrop: from the opening until the backdrop is gone.
  const dim = (on: boolean) => { band.current?.toggleAttribute("data-dim", on && !phone); };
  useLayoutEffect(() => { if (isOpen) dim(true); });

  // Closing takes the composer's popups with it.
  const close = useCallback(() => {
    closePopups(sheet.current);
    setOpen(false);
  }, []);
  useEffect(() => {
    if (!isOpen) return;
    // An Escape a popup handled (closing itself) does not get here.
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    // Scrolling the feed folds it; scrolling the composer, or one of its popups, does not.
    const fold = (event: Event) => {
      const target = event.target as Node;
      if (band.current?.contains(target) || sheet.current?.contains(target) || (target instanceof Element && target.closest(OVERLAYS))) return;
      close();
    };
    window.addEventListener("keydown", onKeyDown);
    // Full screen, the feed under it does not scroll; wider, scrolling the feed folds it.
    const root = document.documentElement;
    const overflow = root.style.overflow;
    if (phone) root.style.overflow = "hidden";
    else {
      window.addEventListener("wheel", fold, { passive: true });
      window.addEventListener("touchmove", fold, { passive: true });
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", fold);
      window.removeEventListener("touchmove", fold);
      root.style.overflow = overflow;
    };
  }, [isOpen, phone, close]);

  const open = () => {
    setReady(true);
    setOpen(true);
  };
  // Posted, or closed with nothing to keep: away, then a fresh composer once it is out of sight.
  const done = useCallback(() => {
    close();
    setDraft(false);
    window.clearTimeout(reset.current);
    reset.current = window.setTimeout(() => setRound((n) => n + 1), SHOW_MS);
  }, [close]);

  // The same element while it is open or closed, so opening and closing do not render the editor again (that work
  // would hold the animation's first frame back).
  const composer = useMemo(() => isReady && <PostComposer key={round} onDone={done} onDirtyChange={setDraft} />, [isReady, round, done]);
  const face = (size: "md" | "sm") => <UserAvatar fullName={user?.fullName} avatarUrl={profile?.avatarUrl} size={size} className="shrink-0" />;

  if (phone) return (
    <MotionConfig transition={SPRING} reducedMotion={reduced ? "always" : "never"}>
      <div ref={band} data-composer-band data-composer-motion className="composer-band sticky top-(--app-header-height) z-[5] -mt-(--app-main-padding) pt-(--app-main-padding)">
        <Card className="flex-row items-center gap-3" onPointerEnter={() => setReady(true)} onFocus={() => setReady(true)}>
          <span data-composer-avatar>{face("md")}</span>
          <ComposerPrompt hasDraft={hasDraft} onOpen={open} />
        </Card>
        {/* On the body: the top bar's layer would cover it otherwise. Resting below the screen when closed. */}
        {createPortal(
          <motion.div ref={sheet} role="dialog" aria-modal aria-label={t("posts.newPost")} data-open={isOpen || undefined} inert={!isOpen}
            className="composer-fullscreen" initial={false} animate={{ y: isOpen ? "0%" : "100%" }}>
            {composer}
          </motion.div>,
          document.body,
        )}
      </div>
    </MotionConfig>
  );
  return (
    <MotionConfig transition={SPRING} reducedMotion={reduced ? "always" : "never"}>
      <LayoutGroup id={group}>
      <div ref={band} data-composer-band data-composer-motion className="composer-band sticky top-(--app-header-height) z-[5] -mt-(--app-main-padding) pt-(--app-main-padding)">
        {createPortal(
          <motion.div data-composer-backdrop aria-hidden className="composer-backdrop" onClick={close} initial={false}
            animate={{ opacity: isOpen ? 1 : 0 }} transition={{ duration: reduced ? 0 : 0.3 }} style={{ pointerEvents: isOpen ? "auto" : "none" }}
            onAnimationComplete={() => { if (!isOpen) dim(false); }} />,
          document.body,
        )}
        {/* Keeps the box's place in the feed while the card, over it, grows. */}
        <div aria-hidden className="composer-place" />
        <motion.div layout data-composer-card data-open={isOpen || undefined} className="card card--default composer-card"
          style={{ borderRadius: 24 }} onPointerEnter={() => setReady(true)} onFocus={() => setReady(true)}>
          <motion.div layout className="composer-card-content">
            <AnimatePresence initial={false} mode="popLayout">
              {!isOpen && (
                // Counter-scaled with the card (`layout`), so never stretched; it blurs and lifts away as the card
                // grows, and comes back, blurred to clear, once the card is about the box's size again.
                <motion.div key="box" layout className="flex items-center gap-3"
                  initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { delay: 0.18, duration: 0.22, ease: [0.2, 0, 0, 1] } }}
                  exit={{ opacity: 0, y: -4, filter: "blur(4px)", transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }}>
                  <motion.span layoutId="composer-avatar" data-composer-avatar className="inline-flex">{face("md")}</motion.span>
                  <ComposerPrompt hasDraft={hasDraft} onOpen={open} />
                </motion.div>
              )}
            </AnimatePresence>
            {/* Where the composer's own avatar is (kept hidden), the box's avatar lands. */}
            {isOpen && <motion.span layoutId="composer-avatar" data-composer-avatar className="composer-card-avatar">{face("sm")}</motion.span>}
            <div ref={sheet} data-composer data-open={isOpen || undefined} inert={!isOpen} hidden={!isOpen} className="composer-sheet">
              {composer}
            </div>
          </motion.div>
        </motion.div>
      </div>
      </LayoutGroup>
    </MotionConfig>
  );
}
