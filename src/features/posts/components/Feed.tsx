"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pin } from "@gravity-ui/icons";
import { Alert, Button, Card, Modal, Skeleton } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { useGetMyProfileQuery, useGetPinnedPostsQuery, type PostDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { usePhone } from "@/shared/hooks/usePhone";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { WindowList } from "@/shared/ui/WindowList";
import { useLocale } from "@/shared/i18n";
import { useGetFeedInfiniteQuery } from "../api";
import { useLoadMore } from "../hooks/useLoadMore";
import { PostComposer } from "./composer/PostComposer";
import { PostCard } from "./PostCard";

/** The company feed on the home page: newest posts first, loading more while scrolling. */
export function Feed() {
  const { t } = useLocale();
  const { data, isLoading, isError, isFetchNextPageError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useGetFeedInfiniteQuery();
  const { data: pinned } = useGetPinnedPostsQuery();
  const { hasPermission } = useCurrentUser();
  const [editing, setEditing] = useState<PostDto | null>(null);
  const sentinel = useLoadMore({ hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage });

  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section aria-label={t("posts.feed")} className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      {hasPermission(Permissions.Posts.Create) && <PinnedComposer />}

      {pinned && pinned.length > 0 && (
        <section aria-labelledby="pinned-heading" className="flex flex-col gap-3">
          <h2 id="pinned-heading" className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Pin aria-hidden className="size-4 text-accent" />
            {t("posts.pinned")}
          </h2>
          {pinned.map((post) => (
            <PostCard key={post.id} post={post} onEdit={setEditing} />
          ))}
          <h2 className="pt-2 text-sm font-semibold text-foreground">{t("posts.latest")}</h2>
        </section>
      )}

      {isLoading ? (
        <FeedSkeleton />
      ) : isError && posts.length === 0 ? (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t("posts.loadError")}</Alert.Title>
          </Alert.Content>
          <Button size="sm" variant="secondary" onPress={() => void refetch()}>
            {t("posts.retry")}
          </Button>
        </Alert>
      ) : posts.length === 0 ? (
        <Card className="items-center py-10 text-center">
          <p className="text-base font-medium text-foreground">{t("posts.empty")}</p>
          <p className="text-sm text-muted">{t("posts.emptyHint")}</p>
        </Card>
      ) : (
        <>
          {/* Only the posts near the viewport are in the page, however deep the feed is scrolled. */}
          <WindowList
            items={posts}
            getKey={(post) => post.id}
            gap={16}
            renderItem={(post) => <PostCard post={post} onEdit={setEditing} />}
          />
          <div ref={sentinel} aria-hidden />
          {/* The next page: placeholder posts where it will appear, as when the feed first loads. */}
          {isFetchingNextPage && <FeedSkeleton count={2} />}
          {/* A failed next page keeps what is already loaded and offers a retry under it. */}
          {isFetchNextPageError && !isFetchingNextPage && (
            <div className="flex items-center justify-center gap-3 py-2 text-sm text-muted">
              {t("posts.loadMoreError")}
              <Button size="sm" variant="secondary" onPress={() => void fetchNextPage()}>
                {t("posts.retry")}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Closing goes through the composer's ✕, which asks before discarding edits (not Esc or a click outside). */}
      <Modal.Backdrop
        isOpen={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        isDismissable={false}
        isKeyboardDismissDisabled
      >
        <Modal.Container size="lg" scroll="outside">
          <Modal.Dialog aria-label={t("posts.edit")}>
            {editing && <PostComposer key={editing.id} post={editing} onDone={() => setEditing(null)} />}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </section>
  );
}

/** The collapsed composer: a prompt that opens the full composer. */
/** How long the composer takes to come and go (globals.css `.composer-pop`, `.composer-fullscreen`). */
const SHOW_MS = 320;

/** Runs `task` when the browser has nothing better to do (soon after the page has loaded). */
function whenIdle(task: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(task, { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, 800);
  return () => window.clearTimeout(id);
}

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
 * The new-post box, pinned under the top bar as the posts scroll, on a band of the page's colour that hides them in the
 * gap above it and beside its top corners. The composer is made ahead, when the browser is idle (or as the box is
 * pointed at), so opening it is only an animation, which moves nothing but itself:
 * - on a phone it slides up full screen over the feed;
 * - wider, it fades and lifts in over the feed where the box is pinned, as tall as the screen at most (it scrolls
 *   inside), and fades away as soon as the posts are scrolled, by a wheel or a swipe outside it (not when the page moves
 *   by itself, as when a phone's keyboard opens).
 * Escape closes it too. Closing keeps what was written; posting or discarding it starts afresh.
 */
function PinnedComposer() {
  const { t } = useLocale();
  const phone = usePhone();
  const [isOpen, setOpen] = useState(false);
  const [isReady, setReady] = useState(false);
  const [hasDraft, setDraft] = useState(false);
  const [round, setRound] = useState(0);
  const band = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const reset = useRef<number | undefined>(undefined);

  useEffect(() => whenIdle(() => setReady(true)), []);
  useEffect(() => () => window.clearTimeout(reset.current), []);
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
    // Into the composer, without scrolling the page to it (it is already on screen).
    window.requestAnimationFrame(() => sheet.current?.querySelector<HTMLElement>("input, [contenteditable=true]")?.focus({ preventScroll: true }));
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
  return (
    <div ref={band} data-composer-band className="composer-band sticky top-(--app-header-height) z-[5] -mt-(--app-main-padding) pt-(--app-main-padding)">
      <ComposerLauncher hasDraft={hasDraft} onOpen={open} onPrepare={() => setReady(true)} />
      {phone
        // On the body: the top bar's layer would cover it otherwise.
        ? createPortal(
          <div ref={sheet} role="dialog" aria-modal aria-label={t("posts.newPost")} data-open={isOpen || undefined} inert={!isOpen} className="composer-fullscreen">
            {composer}
          </div>,
          document.body,
        )
        : (
          <div ref={sheet} data-composer data-open={isOpen || undefined} inert={!isOpen} className="composer-pop">
            <Card className="composer-sheet">{composer}</Card>
          </div>
        )}
    </div>
  );
}

/** The pinned box; pointed at or focused, it has the composer made if it is not yet. */
function ComposerLauncher({ hasDraft, onOpen, onPrepare }: { hasDraft: boolean; onOpen: () => void; onPrepare: () => void }) {
  const { user } = useCurrentUser();
  const { t } = useLocale();
  const { data: profile } = useGetMyProfileQuery(undefined, { skip: !user });

  return (
    <Card className="flex-row items-center gap-3" onPointerEnter={onPrepare} onFocus={onPrepare}>
      <UserAvatar fullName={user?.fullName} avatarUrl={profile?.avatarUrl} size="md" className="shrink-0" />
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 rounded-full bg-default px-4 py-2.5 text-left text-sm text-muted outline-none hover:bg-default-hover focus-visible:ring-2 focus-visible:ring-focus"
      >
        {t(hasDraft ? "posts.continueDraft" : "posts.compose")}
      </button>
    </Card>
  );
}

function FeedSkeleton({ count = 3 }: { count?: number }) {
  const { t } = useLocale();
  return (
    <div role="status" aria-label={t("posts.loadMore")} className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/3 rounded-md" />
              <Skeleton className="h-3 w-1/4 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-5/6 rounded-md" />
        </Card>
      ))}
    </div>
  );
}
