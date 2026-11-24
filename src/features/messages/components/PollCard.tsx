"use client";

import { useState } from "react";
import { Button, Input, Modal, TextField, toast } from "@heroui/react";
import { ChartColumn, Check, Clock, Plus } from "@gravity-ui/icons";
import type { ChatMessageDto, ConversationMemberDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { pollDeadline, pollEndsSoon, pollIsOver, pollRemaining } from "../lib/pollTime";
import { MAX_POLL_OPTION_LENGTH } from "./CreatePollDialog";

/** The same limit as Portal.BE's ConversationRules.MaxPollOptions. */
const MAX_POLL_OPTIONS = 20;

type Translate = (key: string) => string;

/** Who a voter is, for an avatar: the reader is "You"; someone no longer in the conversation has no name. */
function voterOf(userId: number, members: ConversationMemberDto[], myId: number | undefined, t: Translate) {
  if (userId === myId) return { fullName: t("messages.you"), avatarUrl: null };
  const member = members.find((m) => m.userId === userId);
  return { fullName: member?.fullName ?? t("messages.someone"), avatarUrl: member?.avatarUrl ?? null };
}

/** The people who voted, each once. */
export const pollVoterCount = (message: ChatMessageDto) => new Set(message.poll?.options.flatMap((o) => o.voterIds) ?? []).size;

/**
 * A poll in the conversation, as on Messenger: the question, each option with how many chose it (a bar, a count, the
 * first voters' faces), the reader's choice ticked. Pressing an option votes or takes the vote back (one option moves the
 * vote, several toggle); an option can be added while it is open and allowed; "See votes" lists who chose what.
 */
export function PollCard({ message, members, myId, now, onVote, onAddOption, onShowVotes }: {
  message: ChatMessageDto;
  members: ConversationMemberDto[];
  myId: number | undefined;
  /** The clock (ms) its deadline is measured by: it counts down and ends with it. */
  now: number;
  onVote: (message: ChatMessageDto, optionIds: number[]) => Promise<unknown>;
  onAddOption: (message: ChatMessageDto, text: string) => Promise<unknown>;
  onShowVotes: (message: ChatMessageDto) => void;
}) {
  const { t, locale } = useLocale();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newOption, setNewOption] = useState("");
  const poll = message.poll!;
  const multiple = poll.allowsMultipleChoices;
  const closed = pollIsOver(poll, now);
  // When it ended: the time someone ended it, or its deadline when that came first.
  const endedAt = poll.closedAt ?? poll.endsAt;
  const mine = poll.options.filter((o) => myId !== undefined && o.voterIds.includes(myId)).map((o) => o.id);
  const voters = pollVoterCount(message);
  const canAdd = !closed && (poll.allowsNewOptions || message.senderId === myId) && poll.options.length < MAX_POLL_OPTIONS;

  async function choose(optionId: number) {
    const picked = mine.includes(optionId);
    const next = multiple
      ? picked ? mine.filter((id) => id !== optionId) : [...mine, optionId]
      : picked ? [] : [optionId];
    setBusy(true);
    try {
      await onVote(message, next);
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const text = newOption.trim();
    if (!text) return;
    setBusy(true);
    try {
      await onAddOption(message, text);
      setNewOption("");
      setAdding(false);
    } catch (failure) {
      toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-72 max-w-full rounded-2xl border border-separator bg-surface p-3 text-foreground shadow-sm">
      {/* Its kind on the left, its state on the right: how long it still runs, or that it is over. */}
      <div className="flex min-h-5 items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ChartColumn className="size-3.5" /> {t("messages.poll.label")}
        </p>
        {closed ? (
          <span
            title={endedAt ? t("messages.poll.endedAt").replace("{time}", pollDeadline(endedAt, locale)) : undefined}
            className="shrink-0 rounded-full bg-default px-2 py-0.5 text-[0.6875rem] font-medium text-muted"
          >
            {t("messages.poll.closed")}
          </span>
        ) : (
          poll.endsAt && (
            <span
              title={t("messages.poll.endsAt").replace("{time}", pollDeadline(poll.endsAt, locale))}
              className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium tabular-nums ${
                pollEndsSoon(poll.endsAt, now) ? "bg-warning/15 text-warning" : "bg-default text-muted"
              }`}
            >
              <Clock aria-hidden className="size-3" />
              {pollRemaining(poll.endsAt, now, t)}
            </span>
          )
        )}
      </div>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm font-semibold">{message.content}</p>
      <p className="text-xs text-muted">{t(multiple ? "messages.poll.pickMany" : "messages.poll.pickOne")}</p>

      <ul role={multiple ? "group" : "radiogroup"} aria-label={message.content} className="mt-2 flex flex-col gap-1.5">
        {poll.options.map((option) => {
          const picked = mine.includes(option.id);
          const count = option.voterIds.length;
          return (
            <li key={option.id}>
              <button
                type="button"
                role={multiple ? "checkbox" : "radio"}
                aria-checked={picked}
                aria-label={`${option.text}: ${t("messages.poll.voteCount").replace("{count}", String(count))}`}
                disabled={closed || busy}
                onClick={() => void choose(option.id)}
                className="relative flex w-full items-center gap-2 overflow-hidden rounded-xl border border-separator px-2.5 py-2 text-left text-sm outline-none enabled:hover:bg-default focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-default"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 start-0 bg-accent/15 transition-[width] motion-reduce:transition-none"
                  style={{ width: `${voters ? (count / voters) * 100 : 0}%` }}
                />
                <span
                  aria-hidden
                  className={`relative flex size-4 shrink-0 items-center justify-center border ${multiple ? "rounded" : "rounded-full"} ${
                    picked ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface"
                  }`}
                >
                  {picked && <Check className="size-3" />}
                </span>
                <span className="relative min-w-0 flex-1 break-words">{option.text}</span>
                <span aria-hidden className="relative flex shrink-0 items-center gap-1">
                  <span className="flex -space-x-1.5">
                    {option.voterIds.slice(0, 3).map((id) => {
                      const voter = voterOf(id, members, myId, t);
                      return <UserAvatar key={id} fullName={voter.fullName} avatarUrl={voter.avatarUrl} size="sm" className="size-5 text-[0.5rem] ring-2 ring-surface" />;
                    })}
                  </span>
                  <span className="min-w-4 text-end text-xs tabular-nums text-muted">{count}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {canAdd &&
        (adding ? (
          <form
            className="mt-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
          >
            <TextField
              autoFocus
              aria-label={t("messages.poll.addOption")}
              value={newOption}
              onChange={setNewOption}
              maxLength={MAX_POLL_OPTION_LENGTH}
              isDisabled={busy}
              variant="secondary"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setAdding(false);
                  setNewOption("");
                }
              }}
            >
              <Input placeholder={t("messages.poll.newOptionPlaceholder")} />
            </TextField>
          </form>
        ) : (
          <Button size="sm" variant="ghost" className="mt-1" onPress={() => setAdding(true)}>
            <Plus className="size-4" /> {t("messages.poll.addOption")}
          </Button>
        ))}

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
        <span>{voters === 0 ? t("messages.poll.noVotes") : t("messages.poll.voters").replace("{count}", String(voters))}</span>
        {voters > 0 && (
          <button type="button" onClick={() => onShowVotes(message)} className="font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">
            {t("messages.poll.seeVotes")}
          </button>
        )}
      </div>
    </div>
  );
}

/** Who chose what in a poll: each option with its count and its voters, the first first. */
export function PollVotesDialog({ message, members, myId, onClose }: {
  message: ChatMessageDto | null;
  members: ConversationMemberDto[];
  myId: number | undefined;
  onClose: () => void;
}) {
  const { t } = useLocale();
  return (
    <Modal.Backdrop isOpen={message?.poll != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Container size="sm" placement="center" scroll="inside">
        <Modal.Dialog className="max-h-[min(36rem,calc(100dvh-2rem))]">
          <Modal.CloseTrigger aria-label={t("messages.close")} />
          <Modal.Header>
            <Modal.Heading>{t("messages.poll.votesTitle")}</Modal.Heading>
            {message && <p className="text-sm text-muted">{message.content}</p>}
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            {message?.poll?.options.map((option) => (
              <section key={option.id}>
                <h3 className="flex items-baseline justify-between gap-2 text-sm font-semibold">
                  <span className="min-w-0 break-words">{option.text}</span>
                  <span className="shrink-0 text-xs font-normal text-muted">
                    {t("messages.poll.voteCount").replace("{count}", String(option.voterIds.length))}
                  </span>
                </h3>
                <ul className="mt-1 flex flex-col gap-1">
                  {option.voterIds.map((id) => {
                    const voter = voterOf(id, members, myId, t);
                    return (
                      <li key={id} className="flex items-center gap-2 text-sm">
                        <UserAvatar fullName={voter.fullName} avatarUrl={voter.avatarUrl} size="sm" />
                        <span className="truncate">{voter.fullName}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
