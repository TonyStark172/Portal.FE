import type { ReactionKind } from "@/shared/api/generated/portalApi";

/** The reactions a post accepts (Portal.BE ReactionKind), in the order they are offered. */
export const reactions: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "Like", emoji: "👍", label: "Thích" },
  { kind: "Love", emoji: "❤️", label: "Yêu thích" },
  { kind: "Haha", emoji: "😆", label: "Haha" },
  { kind: "Wow", emoji: "😮", label: "Wow" },
  { kind: "Sad", emoji: "😢", label: "Buồn" },
  { kind: "Angry", emoji: "😠", label: "Phẫn nộ" },
];

export const reactionOf = (kind: ReactionKind) => reactions.find((r) => r.kind === kind)!;
