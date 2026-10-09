"use client";

import { useState } from "react";
import { FaceSmile } from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Modal,
  Popover,
  Skeleton,
  Tabs,
  Tooltip,
  toast,
} from "@heroui/react";
import type { PostDto, ReactionKind } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { useClearReactionMutation, useGetReactionsInfiniteQuery, useSetReactionMutation } from "../api";
import { useLoadMore } from "../hooks/useLoadMore";
import { formatCompact, formatCount } from "../lib/count";
import { reactionOf, reactions } from "../lib/reactions";

/** The bottom line of a post: who reacted (summary, opens the list) and the button to react. */
export function PostReactions({ post }: { post: PostDto }) {
  const [isListOpen, setListOpen] = useState(false);
  const total = post.reactions.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="flex items-center justify-between gap-2 border-t border-separator pt-2">
      {total > 0 ? (
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="flex min-w-0 items-center gap-1.5 rounded-full px-1 py-0.5 text-sm text-muted outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
        >
          <span aria-hidden className="flex shrink-0">
            {post.reactions.slice(0, 3).map((r) => (
              <span key={r.kind} className="-ms-0.5 first:ms-0">
                {reactionOf(r.kind).emoji}
              </span>
            ))}
          </span>
          <span className="truncate">{summaryText(total, post.myReaction)}</span>
          <span className="sr-only">— xem ai đã bày tỏ cảm xúc</span>
        </button>
      ) : (
        <span />
      )}

      <ReactButton post={post} />

      <ReactionsModal post={post} isOpen={isListOpen} onOpenChange={setListOpen} />
    </div>
  );
}

/** "Bạn và 2,7K người khác", "Bạn", or the count alone. */
function summaryText(total: number, mine: ReactionKind | null | undefined): string {
  if (!mine) return formatCompact(total);
  return total === 1 ? "Bạn" : `Bạn và ${formatCompact(total - 1)} người khác`;
}

/** Shows the user's reaction (or a neutral face); opens the six reactions. Picking the current one removes it. */
function ReactButton({ post }: { post: PostDto }) {
  const [setReaction] = useSetReactionMutation();
  const [clearReaction] = useClearReactionMutation();
  const [isOpen, setOpen] = useState(false);
  const mine = post.myReaction ? reactionOf(post.myReaction) : null;

  async function pick(kind: ReactionKind) {
    setOpen(false);
    try {
      if (kind === post.myReaction) await clearReaction({ postId: post.id }).unwrap();
      else await setReaction({ postId: post.id, kind }).unwrap();
    } catch (error) {
      toast.danger(toApiProblem(error).detail ?? "Không bày tỏ được cảm xúc. Vui lòng thử lại.");
    }
  }

  return (
    <Popover isOpen={isOpen} onOpenChange={setOpen}>
      {/* On phones only the icon shows, leaving the line to who reacted; the label stays for screen readers. */}
      <Button
        size="sm"
        variant="ghost"
        className={`shrink-0 max-sm:px-2 ${mine ? "font-semibold text-accent" : "text-muted"}`}
      >
        {mine ? <span aria-hidden>{mine.emoji}</span> : <FaceSmile className="size-4" />}
        <span className="max-sm:sr-only">{mine ? mine.label : "Bày tỏ cảm xúc"}</span>
      </Button>
      <Popover.Content placement="top end">
        <Popover.Dialog aria-label="Chọn cảm xúc" className="flex gap-1 p-1.5">
          {reactions.map((r) => (
            <Tooltip key={r.kind} delay={200}>
              <button
                type="button"
                aria-label={r.label}
                aria-pressed={post.myReaction === r.kind}
                onClick={() => void pick(r.kind)}
                className="flex size-10 items-center justify-center rounded-full text-2xl outline-none transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:ring-focus aria-pressed:bg-accent-soft motion-reduce:transition-none"
              >
                {r.emoji}
              </button>
              <Tooltip.Content>{r.label}</Tooltip.Content>
            </Tooltip>
          ))}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/**
 * Who reacted, newest first (as on Facebook): one tab per reaction above the list, the list alone scrolls and loads
 * more on the way down. Tabs that do not fit get scroll arrows and faded edges (Tabs.ListContainer).
 */
function ReactionsModal({ post, isOpen, onOpenChange }: { post: PostDto; isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const [filter, setFilter] = useState<ReactionKind | "all">("all");
  const tabs: (ReactionKind | "all")[] = ["all", ...post.reactions.map((r) => r.kind)];

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg" scroll="inside">
        {/* A fixed height, so switching tabs or loading never resizes the dialog. */}
        <Modal.Dialog className="h-[min(36rem,100%)] sm:max-w-2xl">
          <Modal.CloseTrigger aria-label="Đóng" />
          <Modal.Heading className="sr-only">Cảm xúc</Modal.Heading>
          {/* The tab row stays put; only the panel below it scrolls. */}
          <Tabs
            variant="secondary"
            selectedKey={filter}
            onSelectionChange={(key) => setFilter(key as ReactionKind | "all")}
            className="min-h-0 flex-1"
          >
            <Tabs.ListContainer className="me-10">
              <Tabs.List aria-label="Lọc theo cảm xúc">
                <Tabs.Tab id="all" className="w-auto px-3">
                  Tất cả
                  <Tabs.Indicator />
                </Tabs.Tab>
                {post.reactions.map((r) => (
                  <Tabs.Tab
                    key={r.kind}
                    id={r.kind}
                    aria-label={`${reactionOf(r.kind).label}: ${formatCount(r.count)}`}
                    className="w-auto gap-1.5 px-3"
                  >
                    <span aria-hidden className="text-base">
                      {reactionOf(r.kind).emoji}
                    </span>
                    {formatCompact(r.count)}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {tabs.map((tab) => (
              <Tabs.Panel key={tab} id={tab} className="min-h-0 flex-1 overflow-y-auto p-0 pt-1">
                {isOpen && <ReactionList postId={post.id} kind={tab === "all" ? null : tab} />}
              </Tabs.Panel>
            ))}
          </Tabs>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function ReactionList({ postId, kind }: { postId: number; kind: ReactionKind | null }) {
  const { currentData, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage, isFetchNextPageError } =
    useGetReactionsInfiniteQuery({ postId, kind });
  const sentinel = useLoadMore({ hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage });
  const people = currentData?.pages.flatMap((page) => page.items);

  if (!people) {
    return isError ? (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Không tải được danh sách.</Alert.Title>
        </Alert.Content>
        <Button size="sm" variant="secondary" onPress={() => void refetch()}>
          Thử lại
        </Button>
      </Alert>
    ) : (
      // Enough placeholder rows to fill the panel, under one shimmer that sweeps them together.
      <div role="status" aria-label="Đang tải" className="skeleton--shimmer relative flex h-full flex-col gap-2 overflow-hidden">
        {Array.from({ length: 12 }, (_, i) => (
          <PersonSkeleton key={i} animationType="none" />
        ))}
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {people.map((p) => (
          <li key={p.userId} className="flex items-center gap-3">
            <span className="relative shrink-0">
              <UserAvatar fullName={p.fullName} avatarUrl={p.avatarUrl} size="md" />
              <span aria-hidden className="absolute -end-1 bottom-0 text-sm leading-none">
                {reactionOf(p.kind).emoji}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">{p.fullName}</span>
              <span className="block truncate text-xs text-muted">
                {[p.positionName, reactionOf(p.kind).label].filter(Boolean).join(" · ")}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {/* While more people remain, the list ends with a placeholder row; reaching it loads the next page. */}
      {hasNextPage && !isFetchNextPageError && (
        <div ref={sentinel} role="status" aria-label="Đang tải thêm" className="pt-2">
          <PersonSkeleton />
        </div>
      )}
      {isFetchNextPageError && !isFetchingNextPage && (
        <div className="flex items-center justify-center gap-3 py-2 text-sm text-muted">
          Không tải thêm được.
          <Button size="sm" variant="secondary" onPress={() => void fetchNextPage()}>
            Thử lại
          </Button>
        </div>
      )}
    </>
  );
}

/** A person row (avatar, name, position) while it loads. */
function PersonSkeleton({ animationType }: { animationType?: "none" }) {
  return (
    <div className="flex items-center gap-3">
      <Skeleton animationType={animationType} className="size-10 shrink-0 rounded-full" />
      <div className="flex flex-col gap-1.5">
        <Skeleton animationType={animationType} className="h-3.5 w-40 rounded-full" />
        <Skeleton animationType={animationType} className="h-3 w-24 rounded-full" />
      </div>
    </div>
  );
}
