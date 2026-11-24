"use client";

import { memo, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button, Dropdown, Label, Tooltip } from "@heroui/react";
import {
  ArrowShapeTurnUpRight,
  ArrowUturnCcwLeft,
  CircleStop,
  Copy,
  Ellipsis,
  FaceSmile,
  Pencil,
  Pin,
  PinSlash,
  TrashBin,
} from "@gravity-ui/icons";
import type { ChatMessageDto, ConversationMemberDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { clockTime } from "../lib/messageTime";
import { pollIsOver } from "../lib/pollTime";
import { attachmentsLabel, isEmojiOnly, linkify, memberName, systemText } from "../lib/messageText";
import { ChatAttachments } from "./ChatAttachments";
import { PollCard } from "./PollCard";
import { ReactionPopover } from "./ReactionPopover";

/** The same window as Portal.BE's ConversationRules.EditWindow. */
export const EDIT_WINDOW_MS = 15 * 60_000;

export type MessageAction = "reply" | "edit" | "forward" | "copy" | "pin" | "unpin" | "recall" | "hide" | "closePoll";

export type MessageItemProps = {
  message: ChatMessageDto;
  members: ConversationMemberDto[];
  isGroup: boolean;
  /** Whether the reader administers the group (may end anyone's poll). */
  isAdmin: boolean;
  myId: number | undefined;
  /** First of a run from the same person: a little space above, and in a group their name. */
  startsGroup: boolean;
  /** Last of a run: the other person's avatar beside it. */
  endsGroup: boolean;
  /** Members whose reading stops at this message, shown as small avatars under it. */
  seenBy: ConversationMemberDto[];
  /** The clock the edit window is measured by (ms). */
  now: number;
  onAction: (action: MessageAction, message: ChatMessageDto) => void;
  onReact: (message: ChatMessageDto, emoji: string | null) => void;
  /** Opens the list of who reacted. */
  onShowReactions: (message: ChatMessageDto) => void;
  onJumpTo: (messageId: number) => void;
  onVote: (message: ChatMessageDto, optionIds: number[]) => Promise<unknown>;
  onAddPollOption: (message: ChatMessageDto, text: string) => Promise<unknown>;
  onShowPollVotes: (message: ChatMessageDto) => void;
};

/** A line about the group ("Lan renamed the group…"); a pin line takes to the message pinned. */
function SystemLine({ message, members, myId, onJumpTo }: Pick<MessageItemProps, "message" | "members" | "myId" | "onJumpTo">) {
  const { t } = useLocale();
  const text = systemText(message, members, myId, t);
  return (
    <div id={`message-${message.id}`} className="message-row my-1.5 flex justify-center px-6">
      {message.systemEvent === "MessagePinned" && message.replyTo ? (
        <button type="button" onClick={() => onJumpTo(message.replyTo!.id)} className="flex items-center gap-1 text-center text-xs text-muted hover:underline">
          <Pin className="size-3 shrink-0" /> {text}
        </button>
      ) : (
        <p className="text-center text-xs text-muted">{text}</p>
      )}
    </div>
  );
}

/** A plain button of a row's actions, as it stands in before the row is pointed at. */
const ACTION_BUTTON = "flex size-7 items-center justify-center rounded-full text-muted outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus";

/**
 * One message: its bubble (or large emoji), what it answers, its files and reactions, and the actions under the pointer.
 * The actions are plain buttons until the row is pointed at or focused, and only then get their tooltips, the reaction
 * picker and the menu: a long conversation has thousands of rows, and those are most of what a row costs to draw.
 */
export const MessageItem = memo(function MessageItem(props: MessageItemProps) {
  const { message, members, isGroup, isAdmin, myId, startsGroup, endsGroup, seenBy, now } = props;
  const { onAction, onReact, onShowReactions, onJumpTo, onVote, onAddPollOption, onShowPollVotes } = props;
  const { t, locale } = useLocale();
  const [actionsOpen, setActionsOpen] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  // The action focused when the row was armed by the keyboard: its full version takes the focus over.
  const refocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!armed || refocus.current === null) return;
    row.current?.querySelector<HTMLElement>(`[data-action="${refocus.current}"]`)?.focus();
    refocus.current = null;
  }, [armed]);

  if (message.kind === "System") return <SystemLine message={message} members={members} myId={myId} onJumpTo={onJumpTo} />;

  const mine = message.senderId === myId;
  const sender = members.find((member) => member.userId === message.senderId);
  const time = clockTime(message.sentAt, locale);
  const poll = message.kind === "Poll" && !message.isRecalled ? message.poll : null;
  const big = !message.isRecalled && !poll && message.attachments.length === 0 && isEmojiOnly(message.content);
  const canEdit = mine && !poll && !message.isRecalled && now - new Date(message.sentAt).getTime() < EDIT_WINDOW_MS;
  const canClosePoll = poll !== null && !pollIsOver(poll, now) && (mine || isAdmin);
  const myReaction = message.reactions.find((reaction) => myId !== undefined && reaction.userIds.includes(myId))?.emoji ?? null;

  const menu: { id: MessageAction; label: string; icon: ReactNode; danger?: boolean }[] = !armed
    ? []
    : message.isRecalled
    ? [{ id: "hide", label: t("messages.action.hide"), icon: <TrashBin className="size-4" /> }]
    : [
        ...(poll ? [] : [{ id: "forward" as const, label: t("messages.action.forward"), icon: <ArrowShapeTurnUpRight className="size-4" /> }]),
        ...(canClosePoll ? [{ id: "closePoll" as const, label: t("messages.poll.close"), icon: <CircleStop className="size-4" /> }] : []),
        ...(message.content ? [{ id: "copy" as const, label: t("messages.action.copy"), icon: <Copy className="size-4" /> }] : []),
        ...(canEdit ? [{ id: "edit" as const, label: t("messages.action.edit"), icon: <Pencil className="size-4" /> }] : []),
        message.pinnedAt
          ? { id: "unpin" as const, label: t("messages.action.unpin"), icon: <PinSlash className="size-4" /> }
          : { id: "pin" as const, label: t("messages.action.pin"), icon: <Pin className="size-4" /> },
        ...(mine ? [{ id: "recall" as const, label: t("messages.action.recall"), icon: <ArrowUturnCcwLeft className="size-4" />, danger: true }] : []),
        { id: "hide", label: t("messages.action.hide"), icon: <TrashBin className="size-4" />, danger: true },
      ];

  const actionsClass = `flex shrink-0 items-center self-center opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100 ${
    actionsOpen || reactionsOpen ? "opacity-100" : ""
  } ${mine ? "flex-row-reverse" : ""}`;
  const actions = !armed ? (
    <div className={actionsClass}>
      {!message.isRecalled && (
        <>
          <button type="button" data-action="react" aria-label={t("messages.action.react")} className={ACTION_BUTTON}>
            <FaceSmile className="size-4" />
          </button>
          <button type="button" data-action="reply" aria-label={t("messages.action.reply")} className={ACTION_BUTTON} onClick={() => onAction("reply", message)}>
            <ArrowUturnCcwLeft className="size-4" />
          </button>
        </>
      )}
      <button type="button" data-action="more" aria-label={t("messages.action.more")} className={ACTION_BUTTON}>
        <Ellipsis className="size-4" />
      </button>
    </div>
  ) : (
    <div className={actionsClass}>
      {!message.isRecalled && (
        <>
          <ReactionPopover
            placement={mine ? "top end" : "top start"}
            myReaction={myReaction}
            onPick={(emoji) => onReact(message, emoji)}
            onOpenChange={setReactionsOpen}
            trigger={
              <Tooltip delay={400}>
                <Button isIconOnly size="sm" variant="ghost" data-action="react" aria-label={t("messages.action.react")} className="size-7 min-w-7 text-muted">
                  <FaceSmile className="size-4" />
                </Button>
                <Tooltip.Content>{t("messages.action.react")}</Tooltip.Content>
              </Tooltip>
            }
          />
          <Tooltip delay={400}>
            <Button isIconOnly size="sm" variant="ghost" data-action="reply" aria-label={t("messages.action.reply")} className="size-7 min-w-7 text-muted" onPress={() => onAction("reply", message)}>
              <ArrowUturnCcwLeft className="size-4" />
            </Button>
            <Tooltip.Content>{t("messages.action.reply")}</Tooltip.Content>
          </Tooltip>
        </>
      )}
      <Dropdown onOpenChange={setActionsOpen}>
        <Dropdown.Trigger data-action="more" aria-label={t("messages.action.more")} className={ACTION_BUTTON}>
          <Ellipsis className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement={mine ? "top end" : "top start"}>
          <Dropdown.Menu aria-label={t("messages.action.more")} onAction={(key) => onAction(key as MessageAction, message)}>
            {menu.map((item) => (
              <Dropdown.Item key={item.id} id={item.id} textValue={item.label} variant={item.danger ? "danger" : undefined}>
                {item.icon}
                <Label>{item.label}</Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );

  const reactionCount = message.reactions.reduce((sum, reaction) => sum + reaction.userIds.length, 0);

  return (
    <div
      ref={row}
      id={`message-${message.id}`}
      onPointerEnter={armed ? undefined : () => setArmed(true)}
      onFocusCapture={
        armed
          ? undefined
          : (event) => {
              refocus.current = (event.target as HTMLElement).dataset.action ?? null;
              setArmed(true);
            }
      }
      className={`message-row group/message relative flex flex-col ${mine ? "items-end" : "items-start"} ${startsGroup ? "mt-2.5" : "mt-0.5"}`}
    >
      {isGroup && !mine && startsGroup && (
        <span className="ms-10 mb-0.5 text-[0.6875rem] text-muted">{sender?.fullName ?? t("messages.deletedAccount")}</span>
      )}
      {message.isForwarded && !message.isRecalled && (
        <span className={`mb-0.5 flex items-center gap-1 text-[0.6875rem] text-muted ${mine ? "" : "ms-10"}`}>
          <ArrowShapeTurnUpRight className="size-3" /> {t("messages.forwardedLabel")}
        </span>
      )}

      <div className={`relative flex max-w-full items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
        {!mine && (
          <span className="flex size-8 shrink-0 items-end">
            {endsGroup && <UserAvatar fullName={sender?.fullName} avatarUrl={sender?.avatarUrl} size="sm" className="size-8" />}
          </span>
        )}

        <div className={`flex min-w-0 max-w-[min(75%,36rem)] flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
          {message.replyTo && !message.isRecalled && (
            <button
              type="button"
              onClick={() => onJumpTo(message.replyTo!.id)}
              className={`max-w-full rounded-2xl border border-separator px-3 py-1.5 text-left text-xs text-muted outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus ${mine ? "rounded-br-md" : "rounded-bl-md"}`}
            >
              <span className="block font-medium">
                {t("messages.replyingTo").replace("{name}", memberName(message.replyTo.senderId, members, myId, t))}
              </span>
              <span className="line-clamp-2 italic">
                {message.replyTo.isRecalled
                  ? t("messages.recalled")
                  : message.replyTo.content || attachmentsLabel(message.replyTo.attachmentKinds, t)}
              </span>
            </button>
          )}

          {message.isRecalled ? (
            <div title={time} className="rounded-2xl border border-separator px-3 py-1.5 text-sm italic text-muted">
              {t("messages.recalled")}
            </div>
          ) : poll ? (
            <div title={time} className="max-w-full">
              <PollCard message={message} members={members} myId={myId} now={now} onVote={onVote} onAddOption={onAddPollOption} onShowVotes={onShowPollVotes} />
            </div>
          ) : (
            <>
              {message.attachments.length > 0 && <ChatAttachments attachments={message.attachments} mine={mine} />}
              {message.content &&
                (big ? (
                  <div title={time} className="text-4xl leading-tight">{message.content}</div>
                ) : (
                  <div
                    title={time}
                    onClick={() => setActionsOpen((open) => !open)}
                    className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${
                      mine ? "bg-accent text-accent-foreground" : "bg-default text-foreground"
                    }`}
                  >
                    {linkify(message.content)}
                    <span className={`ms-2 inline-flex translate-y-0.5 items-center gap-1 text-[0.625rem] ${mine ? "text-accent-foreground/70" : "text-muted"}`}>
                      {message.editedAt && <span>{t("messages.edited")}</span>}
                      {time}
                    </span>
                  </div>
                ))}
            </>
          )}

          {(message.reactions.length > 0 || message.pinnedAt) && (
            <div className={`-mt-2 flex items-center gap-1 ${mine ? "me-2" : "ms-2"}`}>
              {message.pinnedAt && (
                <span title={t("messages.pinned")} className="flex size-5 items-center justify-center rounded-full border border-separator bg-overlay text-muted">
                  <Pin className="size-3" />
                </span>
              )}
              {message.reactions.length > 0 && (
                <Tooltip delay={300}>
                  <button
                    type="button"
                    aria-label={`${message.reactions.map((reaction) => reaction.emoji).join(" ")} ${reactionCount} — ${t("messages.viewReactions")}`}
                    onClick={() => onShowReactions(message)}
                    className="flex items-center gap-0.5 rounded-full border border-separator bg-overlay px-1.5 py-0.5 text-xs shadow-sm outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <span aria-hidden className="flex items-center gap-0.5">
                      {message.reactions.slice(0, 3).map((reaction) => <span key={reaction.emoji}>{reaction.emoji}</span>)}
                    </span>
                    {reactionCount > 1 && <span className="ms-0.5 text-muted">{reactionCount}</span>}
                  </button>
                  <Tooltip.Content className="whitespace-pre-line text-start">
                    {message.reactions
                      .map((reaction) => `${reaction.emoji} ${reaction.userIds.map((id) => memberName(id, members, myId, t)).join(", ")}`)
                      .join("\n")}
                  </Tooltip.Content>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        {actions}
      </div>

      {seenBy.length > 0 && (
        <div className="mt-0.5 flex gap-0.5 pe-1" aria-label={t("messages.seenBy").replace("{names}", seenBy.map((m) => m.fullName).join(", "))}>
          {seenBy.slice(0, 6).map((member) => (
            <UserAvatar key={member.userId} fullName={member.fullName} avatarUrl={member.avatarUrl} size="sm" className="size-3.5 text-[0.5rem]" />
          ))}
        </div>
      )}
    </div>
  );
});
