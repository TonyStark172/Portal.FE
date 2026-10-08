"use client";

import { useState } from "react";
import { Pin } from "@gravity-ui/icons";
import { Alert, Button, Card, Modal, Skeleton, Spinner } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { useGetMyProfileQuery, useGetPinnedPostsQuery, type PostDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { useGetFeedInfiniteQuery } from "../api";
import { useLoadMore } from "../hooks/useLoadMore";
import { PostComposer } from "./composer/PostComposer";
import { PostCard } from "./PostCard";

/** The company feed on the home page: newest posts first, loading more while scrolling. */
export function Feed() {
  const { data, isLoading, isError, isFetchNextPageError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useGetFeedInfiniteQuery();
  const { data: pinned } = useGetPinnedPostsQuery();
  const { hasPermission } = useCurrentUser();
  const [isComposing, setComposing] = useState(false);
  const [editing, setEditing] = useState<PostDto | null>(null);
  const sentinel = useLoadMore({ hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage });

  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section aria-label="Bảng tin" className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {hasPermission(Permissions.Posts.Create) &&
        (isComposing ? (
          <Card>
            <PostComposer onDone={() => setComposing(false)} />
          </Card>
        ) : (
          <ComposerLauncher onOpen={() => setComposing(true)} />
        ))}

      {pinned && pinned.length > 0 && (
        <section aria-labelledby="pinned-heading" className="flex flex-col gap-3">
          <h2 id="pinned-heading" className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Pin aria-hidden className="size-4 text-accent" />
            Đã ghim
          </h2>
          {pinned.map((post) => (
            <PostCard key={post.id} post={post} onEdit={setEditing} />
          ))}
          <h2 className="pt-2 text-sm font-semibold text-foreground">Bài viết mới nhất</h2>
        </section>
      )}

      {isLoading ? (
        <FeedSkeleton />
      ) : isError && posts.length === 0 ? (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Không tải được bảng tin.</Alert.Title>
          </Alert.Content>
          <Button size="sm" variant="secondary" onPress={() => void refetch()}>
            Thử lại
          </Button>
        </Alert>
      ) : posts.length === 0 ? (
        <Card className="items-center py-10 text-center">
          <p className="text-base font-medium text-foreground">Chưa có bài viết nào</p>
          <p className="text-sm text-muted">Bài viết mới của công ty sẽ hiện ở đây.</p>
        </Card>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onEdit={setEditing} />
          ))}
          <div ref={sentinel} aria-hidden />
          {isFetchingNextPage && (
            <div role="status" aria-label="Đang tải thêm bài viết" className="flex justify-center py-2">
              <Spinner size="sm" />
            </div>
          )}
          {/* A failed next page keeps what is already loaded and offers a retry under it. */}
          {isFetchNextPageError && !isFetchingNextPage && (
            <div className="flex items-center justify-center gap-3 py-2 text-sm text-muted">
              Không tải thêm được bài viết.
              <Button size="sm" variant="secondary" onPress={() => void fetchNextPage()}>
                Thử lại
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
          <Modal.Dialog aria-label="Sửa bài viết">
            {editing && <PostComposer key={editing.id} post={editing} onDone={() => setEditing(null)} />}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </section>
  );
}

/** The collapsed composer: a prompt that opens the full composer. */
function ComposerLauncher({ onOpen }: { onOpen: () => void }) {
  const { user } = useCurrentUser();
  const { data: profile } = useGetMyProfileQuery(undefined, { skip: !user });

  return (
    <Card className="flex-row items-center gap-3">
      <UserAvatar fullName={user?.fullName} avatarUrl={profile?.avatarUrl} size="md" className="shrink-0" />
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 rounded-full bg-default px-4 py-2.5 text-left text-sm text-muted outline-none hover:bg-default-hover focus-visible:ring-2 focus-visible:ring-focus"
      >
        Đăng bài mới…
      </button>
    </Card>
  );
}

function FeedSkeleton() {
  return (
    <div role="status" aria-label="Đang tải bảng tin" className="flex flex-col gap-4">
      {Array.from({ length: 3 }, (_, i) => (
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
