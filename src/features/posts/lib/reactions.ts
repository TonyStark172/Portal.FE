import type { ReactionKind } from "@/shared/api/generated/portalApi";

/** The reactions a post accepts (Portal.BE ReactionKind), in the order they are offered; `label` is a locale key. */
export const reactions: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "Like", emoji: "👍", label: "posts.reactions.like" },
  { kind: "Love", emoji: "❤️", label: "posts.reactions.love" },
  { kind: "Haha", emoji: "😆", label: "posts.reactions.haha" },
  { kind: "Wow", emoji: "😮", label: "posts.reactions.wow" },
  { kind: "Sad", emoji: "😢", label: "posts.reactions.sad" },
  { kind: "Angry", emoji: "😠", label: "posts.reactions.angry" },
];

export const reactionOf = (kind: ReactionKind) => reactions.find((r) => r.kind === kind)!;
