import type { ReactNode } from "react";
import type {
  ChatMessageDto,
  ChatMessageSummaryDto,
  ConversationDto,
  ConversationMemberDto,
  PostFileKind,
} from "@/shared/api/generated/portalApi";

type Translate = (key: string) => string;

/** Within this long of the last heartbeat (the page sends one a minute), a person counts as "active now". */
export const ACTIVE_WINDOW_MS = 3 * 60_000;

export function isActiveNow(lastActiveAt: string | null | undefined, now = Date.now()): boolean {
  return !!lastActiveAt && now - new Date(lastActiveAt).getTime() < ACTIVE_WINDOW_MS;
}

/** "active 5 minutes ago", "active 2 hours ago"; nothing beyond a day or when never seen. */
export function lastActiveLabel(lastActiveAt: string | null | undefined, t: Translate, now = Date.now()): string | null {
  if (!lastActiveAt) return null;
  const minutes = Math.floor((now - new Date(lastActiveAt).getTime()) / 60_000);
  if (minutes < ACTIVE_WINDOW_MS / 60_000) return t("messages.activeNow");
  if (minutes < 60) return t("messages.activeMinutesAgo").replace("{count}", String(minutes));
  if (minutes < 24 * 60) return t("messages.activeHoursAgo").replace("{count}", String(Math.floor(minutes / 60)));
  return null;
}

/** A group's name, or the other person's in a direct conversation. */
export function conversationName(conversation: Pick<ConversationDto, "isGroup" | "name" | "members">, t: Translate): string {
  if (conversation.isGroup) return conversation.name ?? t("messages.group");
  return conversation.members[0]?.fullName ?? t("messages.deletedAccount");
}

/** The given name of a Vietnamese full name: its last word. */
export const givenName = (fullName: string) => fullName.trim().split(/\s+/).at(-1) ?? fullName;

/** Who someone in the conversation is, as a line about them says it: "you", their name, or "a deleted account". */
export function memberName(
  userId: number | null,
  members: ConversationMemberDto[],
  myId: number | undefined,
  t: Translate,
): string {
  if (userId !== null && userId === myId) return t("messages.you");
  return members.find((member) => member.userId === userId)?.fullName ?? t("messages.someone");
}

/** "[Image]", "[2 images]", "[Video]", "[File]"… for a message made of attachments only. */
export function attachmentsLabel(kinds: PostFileKind[], t: Translate): string {
  if (kinds.length === 0) return "";
  const first = kinds[0];
  const key = first === "Image" ? "messages.attachment.image" : first === "Video" ? "messages.attachment.video" : "messages.attachment.file";
  return kinds.length === 1 ? t(key) : t(`${key}Many`).replace("{count}", String(kinds.length));
}

type SystemLike = Pick<ChatMessageDto, "systemEvent" | "eventNames" | "senderId">;

/** A line about the group, in the reader's language: "Lan added Hùng and Minh to the group". */
export function systemText(message: SystemLike, members: ConversationMemberDto[], myId: number | undefined, t: Translate): string {
  const actor = memberName(message.senderId, members, myId, t);
  const names = message.eventNames.join(", ");
  const template = {
    GroupCreated: "messages.system.groupCreated",
    MembersAdded: "messages.system.membersAdded",
    MemberRemoved: "messages.system.memberRemoved",
    MemberLeft: "messages.system.memberLeft",
    GroupRenamed: "messages.system.groupRenamed",
    MessagePinned: "messages.system.messagePinned",
  }[message.systemEvent ?? "GroupCreated"];
  return t(template).replace("{actor}", actor).replace("{names}", names);
}

/** What the list shows of the latest message: who said it (in a group, or when it is one's own) and what. */
export function previewText(
  message: ChatMessageSummaryDto,
  conversation: Pick<ConversationDto, "isGroup" | "members">,
  myId: number | undefined,
  t: Translate,
): string {
  if (message.kind === "System") return systemText(message, conversation.members, myId, t);
  const body = message.isRecalled
    ? t("messages.recalled")
    : message.kind === "Poll"
      ? `📊 ${message.content}`
      : message.content || attachmentsLabel(message.attachmentKinds, t);
  if (message.senderId === myId) return `${t("messages.you")}: ${body}`;
  if (!conversation.isGroup) return body;
  const sender = conversation.members.find((member) => member.userId === message.senderId);
  return sender ? `${givenName(sender.fullName)}: ${body}` : body;
}

const URL_PATTERN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

/** The text with its web addresses as links that open in a new tab; everything else stays plain text. */
export function linkify(text: string): ReactNode[] {
  return text.split(URL_PATTERN).map((part, index) =>
    index % 2 === 1 ? (
      <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 break-all">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic})*\s*){1,3}$/u;

/** A message of one to three emoji and nothing else, drawn large without a bubble as in Messenger. */
export const isEmojiOnly = (text: string) => text.length <= 32 && EMOJI_ONLY.test(text.trim());

/** The quick reactions offered under the pointer; any other emoji comes from the picker. */
export const QUICK_REACTIONS = ["👍", "❤️", "😆", "😮", "😢", "😠"];

/** The button that sends a thumbs-up when nothing is written. */
export const LIKE = "👍";
