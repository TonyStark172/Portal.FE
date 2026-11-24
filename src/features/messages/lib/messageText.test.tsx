import { expect, test } from "vitest";
import type { ChatMessageSummaryDto, ConversationMemberDto } from "@/shared/api/generated/portalApi";
import { attachmentsLabel, isActiveNow, isEmojiOnly, linkify, previewText, systemText } from "./messageText";

const t = (key: string) =>
  ({
    "messages.you": "Bạn",
    "messages.someone": "Một người",
    "messages.recalled": "Tin nhắn đã bị thu hồi",
    "messages.attachment.image": "[Ảnh]",
    "messages.attachment.imageMany": "[{count} ảnh]",
    "messages.system.membersAdded": "{actor} đã thêm {names} vào nhóm",
  })[key] ?? key;

const member = (userId: number, fullName: string): ConversationMemberDto => ({
  userId, fullName, avatarUrl: null, isActive: true, lastReadMessageId: 0, isAdmin: false, lastActiveAt: null,
});
const members = [member(2, "Lê Văn Hùng"), member(3, "Nguyễn Văn An")];
const summary = (over: Partial<ChatMessageSummaryDto>): ChatMessageSummaryDto => ({
  id: 1, kind: "Text", senderId: 2, content: "Chào", isRecalled: false, attachmentKinds: [], systemEvent: null, eventNames: [],
  sentAt: "2026-11-24T08:00:00Z", ...over,
});

test("the list's preview names the sender in a group and oneself everywhere", () => {
  expect(previewText(summary({}), { isGroup: true, members }, 1, t)).toBe("Hùng: Chào");
  expect(previewText(summary({}), { isGroup: false, members }, 1, t)).toBe("Chào");
  expect(previewText(summary({ senderId: 1 }), { isGroup: false, members }, 1, t)).toBe("Bạn: Chào");
  expect(previewText(summary({ isRecalled: true, content: "" }), { isGroup: false, members }, 1, t)).toBe("Tin nhắn đã bị thu hồi");
  expect(previewText(summary({ content: "", attachmentKinds: ["Image", "Image"] }), { isGroup: false, members }, 1, t)).toBe("[2 ảnh]");
});

test("a line about the group says who did it to whom", () => {
  const line = { systemEvent: "MembersAdded" as const, eventNames: ["Nguyễn Văn An"], senderId: 1 };
  expect(systemText(line, members, 1, t)).toBe("Bạn đã thêm Nguyễn Văn An vào nhóm");
  expect(systemText({ ...line, senderId: 2 }, members, 1, t)).toBe("Lê Văn Hùng đã thêm Nguyễn Văn An vào nhóm");
  expect(attachmentsLabel(["Image"], t)).toBe("[Ảnh]");
});

test("only one to three emoji alone are drawn large", () => {
  expect(isEmojiOnly("👍")).toBe(true);
  expect(isEmojiOnly("🎉🎉")).toBe(true);
  expect(isEmojiOnly("❤️")).toBe(true);
  expect(isEmojiOnly("👍👍👍👍")).toBe(false);
  expect(isEmojiOnly("ok 👍")).toBe(false);
  expect(isEmojiOnly("123")).toBe(false);
});

test("web addresses become links and nothing else does", () => {
  const parts = linkify("Xem https://example.com/a?b=1. Cảm ơn <b>");
  expect(parts).toHaveLength(3);
  expect(parts[0]).toBe("Xem ");
  expect((parts[1] as { props: { href: string } }).props.href).toBe("https://example.com/a?b=1");
  expect(parts[2]).toBe(". Cảm ơn <b>");
});

test("someone is active within three minutes of their last heartbeat", () => {
  const now = Date.parse("2026-11-24T08:00:00Z");
  expect(isActiveNow("2026-11-24T07:58:30Z", now)).toBe(true);
  expect(isActiveNow("2026-11-24T07:56:00Z", now)).toBe(false);
  expect(isActiveNow(null, now)).toBe(false);
});
