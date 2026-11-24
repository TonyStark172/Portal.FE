"use client";

import { useState } from "react";
import { Alert, Button, Modal, Skeleton, Tabs } from "@heroui/react";
import { useGetChatMessageReactionsQuery, type ChatMessageDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";

/**
 * Who reacted to a message, as on Messenger: a tab for everyone and one per emoji with its count, each person with
 * their emoji; the reader's own row removes their reaction. The tabs follow the message as it changes (the hub's
 * signal reads it again); the list is read from the server, so it also names people who have left the group.
 */
export function ReactionsDialog({ message, myId, onRemoveMine, onClose }: {
  /** The message whose reactions are shown; null (or none left) closes the dialog. */
  message: ChatMessageDto | null;
  myId: number | undefined;
  onRemoveMine: (message: ChatMessageDto) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [filter, setFilter] = useState("all");
  const [shownFor, setShownFor] = useState<number | null>(null);
  if ((message?.id ?? null) !== shownFor) {
    setShownFor(message?.id ?? null);
    setFilter("all");
  }
  const reactions = message?.reactions ?? [];
  const isOpen = message !== null && reactions.length > 0;
  const { currentData: people, isError, refetch } = useGetChatMessageReactionsQuery(
    { messageId: message?.id ?? 0 },
    { skip: !isOpen },
  );
  // A tab whose emoji nobody uses any more falls back to everyone.
  const selected = reactions.some((reaction) => reaction.emoji === filter) ? filter : "all";
  const total = reactions.reduce((sum, reaction) => sum + reaction.userIds.length, 0);
  const tabs = ["all", ...reactions.map((reaction) => reaction.emoji)];

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Container size="sm" placement="center" scroll="inside">
        <Modal.Dialog className="h-[min(30rem,calc(100dvh-2rem))]">
          <Modal.CloseTrigger aria-label={t("messages.close")} />
          <Modal.Header>
            <Modal.Heading>{t("messages.reactionsTitle")}</Modal.Heading>
          </Modal.Header>
          <Tabs variant="secondary" selectedKey={selected} onSelectionChange={(key) => setFilter(String(key))} className="min-h-0 flex-1">
            <Tabs.ListContainer>
              <Tabs.List aria-label={t("messages.reactionsFilter")}>
                <Tabs.Tab id="all" className="w-auto gap-1.5 px-3">
                  {t("messages.reactionsAll")} {total}
                  <Tabs.Indicator />
                </Tabs.Tab>
                {reactions.map((reaction) => (
                  <Tabs.Tab
                    key={reaction.emoji}
                    id={reaction.emoji}
                    aria-label={`${reaction.emoji}: ${reaction.userIds.length}`}
                    className="w-auto gap-1.5 px-3"
                  >
                    <span aria-hidden className="text-base">{reaction.emoji}</span>
                    {reaction.userIds.length}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {tabs.map((tab) => (
              <Tabs.Panel key={tab} id={tab} className="min-h-0 flex-1 scrollbar overflow-y-auto p-0 pt-2">
                {people ? (
                  <ul className="flex flex-col gap-1">
                    {people
                      .filter((person) => tab === "all" || person.emoji === tab)
                      .map((person) => {
                        const mine = person.userId === myId;
                        const row = (
                          <>
                            <UserAvatar fullName={person.fullName} avatarUrl={person.avatarUrl} size="md" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">{person.fullName}</span>
                              {mine && <span className="block text-xs text-muted">{t("messages.clickToRemove")}</span>}
                            </span>
                            <span aria-hidden className="text-xl">{person.emoji}</span>
                          </>
                        );
                        return (
                          <li key={person.userId}>
                            {mine && message ? (
                              <button
                                type="button"
                                onClick={() => onRemoveMine(message)}
                                className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
                              >
                                {row}
                              </button>
                            ) : (
                              <div className="flex items-center gap-3 px-2 py-1.5">{row}</div>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                ) : isError ? (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{t("messages.reactionsLoadError")}</Alert.Title>
                    </Alert.Content>
                    <Button size="sm" variant="secondary" onPress={() => void refetch()}>
                      {t("common.retry")}
                    </Button>
                  </Alert>
                ) : (
                  <div role="status" className="flex flex-col gap-1">
                    {Array.from({ length: Math.min(total, 6) }, (_, i) => (
                      <div key={i} className="flex items-center gap-3 px-2 py-1.5">
                        <Skeleton className="size-10 shrink-0 rounded-full" />
                        <Skeleton className="h-3.5 w-40 rounded-full" />
                      </div>
                    ))}
                  </div>
                )}
              </Tabs.Panel>
            ))}
          </Tabs>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
