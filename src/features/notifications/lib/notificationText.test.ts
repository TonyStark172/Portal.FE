import { describe, expect, test } from "vitest";
import type { NotificationDto, NotificationKind } from "@/shared/api/generated/portalApi";
import { translate } from "@/shared/i18n/locale";
import { notificationHref, notificationSentence } from "./notificationText";

const inVi = (key: string) => translate(key, "vi-VN");
const inEn = (key: string) => translate(key, "en-US");

const notification = (changes: Partial<NotificationDto> = {}): NotificationDto => ({
  id: 1,
  kind: "PostComment",
  actor: { id: 7, fullName: "Lê Hà", avatarUrl: null },
  actorCount: 1,
  postId: 10,
  commentId: null,
  meetingId: null,
  excerpt: null,
  meetingStartUtc: null,
  occurredAt: "2026-11-03T08:00:00Z",
  isRead: false,
  ...changes,
});

describe("notificationSentence", () => {
  test("writes each kind", () => {
    const expected: Record<NotificationKind, string> = {
      CommentReply: "Lê Hà đã trả lời bình luận của bạn",
      PostComment: "Lê Hà đã bình luận vào bài của bạn",
      CommentMention: "Lê Hà đã nhắc đến bạn trong một bình luận",
      PostMention: "Lê Hà đã nhắc đến bạn trong một bài viết",
      PostMentionEveryone: "Lê Hà đã nhắc đến mọi người trong một bài viết",
      MeetingInvited: "Lê Hà đã thêm bạn vào cuộc họp",
      MeetingRescheduled: "Lê Hà đã đổi lịch cuộc họp",
      MeetingRemoved: "Lê Hà đã gỡ bạn khỏi cuộc họp",
      MeetingCanceled: "Cuộc họp đã bị huỷ",
    };
    for (const [kind, sentence] of Object.entries(expected)) {
      expect(notificationSentence(notification({ kind: kind as NotificationKind }), inVi)).toBe(sentence);
    }
  });

  test("is written in the language asked for, for a notification received before", () => {
    expect(notificationSentence(notification({ kind: "CommentReply" }), inEn)).toBe("Lê Hà replied to your comment");
    expect(notificationSentence(notification({ kind: "MeetingCanceled" }), inEn)).toBe("A meeting was canceled");
  });

  test("a grouped row names the others", () => {
    expect(notificationSentence(notification({ actor: { id: 8, fullName: "Phạm Anh", avatarUrl: null }, actorCount: 4 }), inVi)).toBe(
      "Phạm Anh và 3 người khác đã bình luận vào bài của bạn",
    );
    expect(notificationSentence(notification({ actorCount: 1 }), inVi)).toBe("Lê Hà đã bình luận vào bài của bạn");
  });

  test("a name is written as it is, whatever characters it holds", () => {
    const named = (fullName: string) => notification({ actor: { id: 9, fullName, avatarUrl: null }, actorCount: 3 });

    expect(notificationSentence(named("Lê $& Hà"), inVi)).toBe("Lê $& Hà và 2 người khác đã bình luận vào bài của bạn");
    expect(notificationSentence(named("Hà $1 $` $'"), inEn)).toBe("Hà $1 $` $' and 2 others commented on your post");
  });

  test("counts one other and several others in English", () => {
    expect(notificationSentence(notification({ actorCount: 2 }), inEn)).toBe("Lê Hà and 1 other commented on your post");
    expect(notificationSentence(notification({ actorCount: 4 }), inEn)).toBe("Lê Hà and 3 others commented on your post");
  });

  test("only a comment on a post is grouped", () => {
    expect(notificationSentence(notification({ kind: "CommentReply", actorCount: 5 }), inVi)).toBe("Lê Hà đã trả lời bình luận của bạn");
  });

  test("an actor who is gone reads Ai đó", () => {
    expect(notificationSentence(notification({ actor: null }), inVi)).toBe("Ai đó đã bình luận vào bài của bạn");
    expect(notificationSentence(notification({ actor: null, actorCount: 3 }), inVi)).toBe("Ai đó và 2 người khác đã bình luận vào bài của bạn");
    expect(notificationSentence(notification({ actor: null, kind: "PostMention" }), inEn)).toBe("Someone mentioned you in a post");
  });
});

describe("notificationHref", () => {
  test("links to the comment, the post or the meeting", () => {
    expect(notificationHref(notification({ kind: "CommentReply", postId: 10, commentId: 55 }))).toBe("/?post=10&comment=55");
    expect(notificationHref(notification({ kind: "PostMention", postId: 10, commentId: null }))).toBe("/?post=10");
    expect(notificationHref(notification({ kind: "MeetingInvited", postId: null, meetingId: 4 }))).toBe("/meetings?meeting=4");
  });

  test("a meeting wins over a post when both are set", () => {
    expect(notificationHref(notification({ kind: "MeetingCanceled", postId: 10, meetingId: 4 }))).toBe("/meetings?meeting=4");
  });
});
