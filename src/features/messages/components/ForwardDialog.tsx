"use client";

import { useMemo, useState } from "react";
import { Button, Modal, toast } from "@heroui/react";
import { Check } from "@gravity-ui/icons";
import { useForwardChatMessageMutation, type ChatMessageDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { useGetConversationPagesInfiniteQuery } from "../api";
import { attachmentsLabel, conversationName } from "../lib/messageText";
import { ConversationAvatar } from "./ConversationAvatar";
import { PeoplePicker, PickedChips, togglePerson, type PickedPerson } from "./PeoplePicker";

/** The same limit as Portal.BE's ConversationRules.MaxForwardTargets. */
const MAX_TARGETS = 20;

/** Forwards a message to recent conversations and to colleagues, picked together, then sent in one go. */
export function ForwardDialog({ message, onClose, myId }: { message: ChatMessageDto | null; onClose: () => void; myId: number | undefined }) {
  const { t } = useLocale();
  const { currentData } = useGetConversationPagesInfiniteQuery({ search: "" }, { skip: message === null });
  const recent = useMemo(() => (currentData?.pages ?? []).flatMap((page) => page.items).slice(0, 12), [currentData]);
  const [conversationIds, setConversationIds] = useState<number[]>([]);
  const [people, setPeople] = useState<PickedPerson[]>([]);
  const [forward, { isLoading }] = useForwardChatMessageMutation();
  const [shownFor, setShownFor] = useState<number | null>(null);

  if ((message?.id ?? null) !== shownFor) {
    setShownFor(message?.id ?? null);
    setConversationIds([]);
    setPeople([]);
  }

  const count = conversationIds.length + people.length;
  const toggleConversation = (id: number) =>
    setConversationIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  async function send() {
    if (!message) return;
    try {
      await forward({
        messageId: message.id,
        forwardChatMessageCommand: { conversationIds, userIds: people.map((person) => person.userId) },
      }).unwrap();
      toast.success(t("messages.forwarded"));
      onClose();
    } catch (failure) {
      toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
    }
  }

  return (
    <Modal.Backdrop isOpen={message !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Container size="md" placement="center" scroll="inside">
        <Modal.Dialog className="max-h-[min(42rem,calc(100dvh-2rem))]">
          <Modal.CloseTrigger aria-label={t("messages.close")} />
          <Modal.Header><Modal.Heading>{t("messages.forwardTitle")}</Modal.Heading></Modal.Header>
          <Modal.Body className="flex min-h-0 flex-col gap-3">
            {message && (
              <p className="line-clamp-2 shrink-0 rounded-xl bg-default px-3 py-2 text-sm text-muted">
                {message.content || attachmentsLabel(message.attachments.map((a) => a.kind), t)}
              </p>
            )}
            {recent.length > 0 && (
              <section className="shrink-0">
                <h3 className="mb-1 text-xs font-medium text-muted">{t("messages.recentConversations")}</h3>
                <ul className="flex flex-col gap-0.5">
                  {recent.map((conversation) => {
                    const picked = conversationIds.includes(conversation.id);
                    return (
                      <li key={conversation.id}>
                        <button
                          type="button"
                          aria-pressed={picked}
                          disabled={!picked && count >= MAX_TARGETS}
                          onClick={() => toggleConversation(conversation.id)}
                          className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
                        >
                          <ConversationAvatar conversation={conversation} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-sm">{conversationName(conversation, t)}</span>
                          <span aria-hidden className={`flex size-5 items-center justify-center rounded-full border ${picked ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}>
                            {picked && <Check className="size-3" />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            <section className="flex min-h-0 flex-col gap-1">
              <h3 className="text-xs font-medium text-muted">{t("messages.colleagues")}</h3>
              <PickedChips people={people} onRemove={(userId) => setPeople((current) => current.filter((p) => p.userId !== userId))} />
              <PeoplePicker
                autoFocus={false}
                selected={people}
                exclude={myId ? [myId] : []}
                onPick={(person) => {
                  if (count >= MAX_TARGETS && !people.some((p) => p.userId === person.userId)) return;
                  setPeople((current) => togglePerson(current, person));
                }}
              />
            </section>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>{t("messages.cancel")}</Button>
            <Button isDisabled={count === 0} isPending={isLoading} onPress={() => void send()}>
              {count > 0 ? t("messages.forwardTo").replace("{count}", String(count)) : t("messages.forward")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
