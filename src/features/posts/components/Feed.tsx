"use client";

import { Suspense, lazy, useState } from "react";
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
import { ComposerPrompt } from "./composer/ComposerPrompt";
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
      {hasPermission(Permissions.Posts.Create) && <NewPostBox />}

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

/** The animated new-post box, with the animation library: loaded once the box is wanted. */
const PinnedComposer = lazy(() => import("./composer/PinnedComposer"));

/**
 * The new-post box. The page comes with a plain one, laid out exactly as the animated one at rest; pointing at it,
 * touching it (a finger down comes before its tap ends), focusing it or pressing it loads the animated one (with the animation library, kept out of the page's first load),
 * which takes its place unseen. Pressed before it has come, it opens as soon as it has.
 */
function NewPostBox() {
  const phone = usePhone();
  const { user } = useCurrentUser();
  const { data: profile } = useGetMyProfileQuery(undefined, { skip: !user });
  const [wanted, setWanted] = useState<"no" | "yes" | "open">("no");
  const want = () => setWanted((current) => (current === "no" ? "yes" : current));
  const open = () => setWanted("open");
  const face = <UserAvatar fullName={user?.fullName} avatarUrl={profile?.avatarUrl} size="md" className="shrink-0" />;
  const plain = phone ? (
    <div data-composer-band className="composer-band sticky top-(--app-header-height) z-[5] -mt-(--app-main-padding) pt-(--app-main-padding)">
      <Card className="flex-row items-center gap-3" onPointerEnter={want} onPointerDown={want} onFocus={want}>
        <span data-composer-avatar>{face}</span>
        <ComposerPrompt hasDraft={false} onOpen={open} />
      </Card>
    </div>
  ) : (
    <div data-composer-band className="composer-band sticky top-(--app-header-height) z-[5] -mt-(--app-main-padding) pt-(--app-main-padding)">
      <div aria-hidden className="composer-place" />
      <div data-composer-card className="card card--default composer-card" style={{ borderRadius: 24 }} onPointerEnter={want} onPointerDown={want} onFocus={want}>
        <div className="composer-card-content">
          <div className="flex items-center gap-3">
            <span data-composer-avatar className="inline-flex">{face}</span>
            <ComposerPrompt hasDraft={false} onOpen={open} />
          </div>
        </div>
      </div>
    </div>
  );
  if (wanted === "no") return plain;
  return (
    <Suspense fallback={plain}>
      <PinnedComposer openAtStart={wanted === "open"} />
    </Suspense>
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
