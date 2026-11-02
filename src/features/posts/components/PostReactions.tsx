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
import {
  useReactToPostCommentMutation,
  useRemovePostCommentReactionMutation,
  type PostDto,
  type ReactionCountDto,
  type ReactionKind,
  type ReactionPage,
} from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import {
  useClearReactionMutation,
  useGetCommentReactionsInfiniteQuery,
  useGetReactionsInfiniteQuery,
  useSetReactionMutation,
} from "../api";
import { useLoadMore } from "../hooks/useLoadMore";
import { formatCompact, formatCount } from "../lib/count";
import { reactionOf, reactions } from "../lib/reactions";
import { useLocale } from "@/shared/i18n";
import { CommentButton } from "./CommentButton";

/** What can be reacted to: a post or a comment, with the reactions it has and the reader's own. */
export type ReactionTarget = {
  kind: "post" | "comment";
  id: number;
  reactions: ReactionCountDto[];
  myReaction?: ReactionKind | null;
};

const postTarget = (post: PostDto): ReactionTarget => ({
  kind: "post",
  id: post.id,
  reactions: post.reactions,
  myReaction: post.myReaction,
});

/**
 * The bottom line of a post: who reacted (summary, opens the list), the button to react and the one to comment
 * (left out where the comments are already beside the post).
 */
export function PostReactions({ post, onOpenComments }: { post: PostDto; onOpenComments?: (post: PostDto) => void }) {
  const { t } = useLocale();
  const [isListOpen, setListOpen] = useState(false);
  const total = post.reactions.reduce((sum, r) => sum + r.count, 0);

  // mt-auto: where the column has height to spare (the comments popup's two columns), the line stays at its foot.
  return (
    <div className="mt-auto flex items-center justify-between gap-2 border-t border-separator pt-2">
      {total > 0 ? (
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="tap-target flex min-w-0 items-center gap-1.5 rounded-full px-1 py-0.5 text-sm text-muted outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
        >
          <span aria-hidden className="flex shrink-0">
            {post.reactions.slice(0, 3).map((r) => (
              <span key={r.kind} className="-ms-0.5 first:ms-0">
                {reactionOf(r.kind).emoji}
              </span>
            ))}
          </span>
          <span className="truncate">{summaryText(total, post.myReaction, t)}</span>
          <span className="sr-only">— {t("posts.viewReactions")}</span>
        </button>
      ) : (
        <span />
      )}

      <div className="flex shrink-0 items-center gap-2">
        <ReactButton target={postTarget(post)} />
        {onOpenComments && <CommentButton post={post} onOpen={onOpenComments} />}
      </div>

      <ReactionsModal target={postTarget(post)} isOpen={isListOpen} onOpenChange={setListOpen} />
    </div>
  );
}

/** "Bạn và 2,7K người khác", "Bạn", or the count alone. */
function summaryText(total: number, mine: ReactionKind | null | undefined, t: (key: string) => string): string {
  if (!mine) return formatCompact(total);
  return total === 1 ? t("posts.you") : t("posts.youAndOthers").replace("{count}", formatCompact(total - 1));
}

/**
 * Shows the user's reaction (or a neutral face); opens the six reactions. Picking the current one removes it.
 * `compact` is for a comment's line: smaller, and the label stays on a phone.
 */
export function ReactButton({ target, compact = false }: { target: ReactionTarget; compact?: boolean }) {
  const { t } = useLocale();
  const [setPostReaction] = useSetReactionMutation();
  const [clearPostReaction] = useClearReactionMutation();
  const [setCommentReaction] = useReactToPostCommentMutation();
  const [clearCommentReaction] = useRemovePostCommentReactionMutation();
  const [isOpen, setOpen] = useState(false);
  const mine = target.myReaction ? reactionOf(target.myReaction) : null;

  async function pick(kind: ReactionKind) {
    setOpen(false);
    const { id } = target;
    const isPost = target.kind === "post";
    try {
      if (kind === target.myReaction) await (isPost ? clearPostReaction({ postId: id }) : clearCommentReaction({ id })).unwrap();
      else
        await (isPost
          ? setPostReaction({ postId: id, kind })
          : setCommentReaction({ id, reactToPostCommentCommand: { kind } })
        ).unwrap();
    } catch (error) {
      toast.danger(toApiProblem(error).detail ?? t("common.genericError"));
    }
  }

  return (
    <Popover isOpen={isOpen} onOpenChange={setOpen}>
      {/* On phones only the icon shows, leaving the line to who reacted; the label stays for screen readers. */}
      <Button
        size="sm"
        variant="ghost"
        className={`tap-target shrink-0 ${compact ? "h-7 min-w-0 gap-1 px-2 text-xs" : "max-sm:px-2"} ${mine ? "font-semibold text-accent" : "text-muted"}`}
      >
        {mine ? <span aria-hidden>{mine.emoji}</span> : <FaceSmile className={compact ? "size-3.5" : "size-4"} />}
        <span className={compact ? undefined : "max-sm:sr-only"}>{mine ? t(mine.label) : t("posts.expressReaction")}</span>
      </Button>
      <Popover.Content placement="top end">
        <Popover.Dialog aria-label={t("posts.reaction")} className="flex gap-1 p-1.5">
          {reactions.map((r) => (
            <Tooltip key={r.kind} delay={200}>
              <button
                type="button"
                aria-label={t(r.label)}
                aria-pressed={target.myReaction === r.kind}
                onClick={() => void pick(r.kind)}
                className="flex size-10 items-center justify-center rounded-full text-2xl outline-none transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:ring-focus aria-pressed:bg-accent-soft motion-reduce:transition-none"
              >
                {r.emoji}
              </button>
              <Tooltip.Content>{t(r.label)}</Tooltip.Content>
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
export function ReactionsModal({
  target,
  isOpen,
  onOpenChange,
}: {
  target: ReactionTarget;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLocale();
  const [filter, setFilter] = useState<ReactionKind | "all">("all");
  const tabs: (ReactionKind | "all")[] = ["all", ...target.reactions.map((r) => r.kind)];

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg" scroll="inside">
        {/* A fixed height, so switching tabs or loading never resizes the dialog. */}
        <Modal.Dialog className="h-[min(36rem,100%)] sm:max-w-2xl">
          <Modal.CloseTrigger aria-label={t("posts.close")} />
          <Modal.Heading className="sr-only">{t("posts.reaction")}</Modal.Heading>
          {/* The tab row stays put; only the panel below it scrolls. */}
          <Tabs
            variant="secondary"
            selectedKey={filter}
            onSelectionChange={(key) => setFilter(key as ReactionKind | "all")}
            className="min-h-0 flex-1"
          >
            <Tabs.ListContainer className="me-10">
              <Tabs.List aria-label={t("posts.reactions.filter")}>
                <Tabs.Tab id="all" className="w-auto px-3">
                  {t("posts.reactions.all")}
                  <Tabs.Indicator />
                </Tabs.Tab>
                {target.reactions.map((r) => (
                  <Tabs.Tab
                    key={r.kind}
                    id={r.kind}
                    aria-label={`${t(reactionOf(r.kind).label)}: ${formatCount(r.count)}`}
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
              <Tabs.Panel key={tab} id={tab} className="min-h-0 flex-1 scrollbar overflow-y-auto p-0 pt-1">
                {isOpen && <ReactionList target={target} kind={tab === "all" ? null : tab} />}
              </Tabs.Panel>
            ))}
          </Tabs>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** What ReactionPeople needs of the two infinite queries of who reacted. */
type ReactionQuery = {
  currentData?: { pages: ReactionPage[] };
  isError: boolean;
  refetch: () => unknown;
  hasNextPage: boolean;
  fetchNextPage: () => unknown;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
};

/** Who reacted with `kind` (anyone when null); a post and a comment are read from different endpoints. */
function ReactionList({ target, kind }: { target: ReactionTarget; kind: ReactionKind | null }) {
  return target.kind === "post" ? <PostReactionList postId={target.id} kind={kind} /> : <CommentReactionList commentId={target.id} kind={kind} />;
}

function PostReactionList({ postId, kind }: { postId: number; kind: ReactionKind | null }) {
  return <ReactionPeople query={useGetReactionsInfiniteQuery({ postId, kind })} />;
}

function CommentReactionList({ commentId, kind }: { commentId: number; kind: ReactionKind | null }) {
  return <ReactionPeople query={useGetCommentReactionsInfiniteQuery({ commentId, kind })} />;
}

/** The people of an infinite query of reactions, loading more on the way down. */
function ReactionPeople({ query }: { query: ReactionQuery }) {
  const { t } = useLocale();
  const { currentData, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage, isFetchNextPageError } = query;
  const sentinel = useLoadMore({ hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage });
  const people = currentData?.pages.flatMap((page) => page.items);

  if (!people) {
    return isError ? (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t("posts.reactions.loadError")}</Alert.Title>
        </Alert.Content>
        <Button size="sm" variant="secondary" onPress={() => void refetch()}>
          {t("posts.retry")}
        </Button>
      </Alert>
    ) : (
      // Enough placeholder rows to fill the panel, under one shimmer that sweeps them together.
      <div role="status" aria-label={t("posts.reactions.loading")} className="skeleton--shimmer relative flex h-full flex-col gap-2 overflow-hidden">
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
                {[p.positionName, t(reactionOf(p.kind).label)].filter(Boolean).join(" · ")}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {/* While more people remain, the list ends with a placeholder row; reaching it loads the next page. */}
      {hasNextPage && !isFetchNextPageError && (
        <div ref={sentinel} role="status" aria-label={t("posts.reactions.loadingMore")} className="pt-2">
          <PersonSkeleton />
        </div>
      )}
      {isFetchNextPageError && !isFetchingNextPage && (
        <div className="flex items-center justify-center gap-3 py-2 text-sm text-muted">
          {t("posts.reactions.loadMoreError")}
          <Button size="sm" variant="secondary" onPress={() => void fetchNextPage()}>
            {t("posts.retry")}
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
