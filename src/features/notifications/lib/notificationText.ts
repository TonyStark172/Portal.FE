import type { NotificationDto } from "@/shared/api/generated/portalApi";
import { pluralKey } from "@/shared/i18n";

/**
 * The sentence of a notification in the reader's language: rows hold a kind and the people involved, never a
 * translated text. A comment on a post that several people made is one row, which names the last and counts the rest.
 */
export function notificationSentence(item: NotificationDto, t: (key: string) => string): string {
  const actor = item.actor?.fullName ?? t("notifications.someone");
  const others = item.actorCount - 1;
  const key = item.kind === "PostComment" && others > 0 ? pluralKey("notifications.kind.PostCommentMany", others) : `notifications.kind.${item.kind}`;
  return t(key).replace("{actor}", actor).replace("{others}", String(others));
}

/** Where a notification leads: the comment, the post or the meeting it is about. */
export function notificationHref(item: NotificationDto): string {
  if (item.meetingId !== null) return `/meetings?meeting=${item.meetingId}`;
  if (item.postId === null) return "/";
  return item.commentId === null ? `/?post=${item.postId}` : `/?post=${item.postId}&comment=${item.commentId}`;
}
