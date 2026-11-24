"use client";

import { useState } from "react";
import { Button, Input, Label, Modal, Tabs, TextField, toast } from "@heroui/react";
import { useCreateGroupConversationMutation, useStartDirectConversationMutation } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { PeoplePicker, PickedChips, togglePerson, type PickedPerson } from "./PeoplePicker";

/** The same limit as Portal.BE's ConversationRules.MaxGroupNameLength. */
export const MAX_GROUP_NAME_LENGTH = 100;

type Mode = "direct" | "group";

/**
 * Starts a conversation: with one colleague (picking them opens it), or a new group with a name and at least two
 * colleagues besides oneself.
 */
export function NewConversationDialog({ isOpen, initialMode = "direct", onClose, onOpened, myId }: {
  isOpen: boolean;
  initialMode?: Mode;
  onClose: () => void;
  onOpened: (conversationId: number) => void;
  myId: number | undefined;
}) {
  const { t } = useLocale();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [wasOpen, setWasOpen] = useState(isOpen);
  const [name, setName] = useState("");
  const [people, setPeople] = useState<PickedPerson[]>([]);
  const [start, { isLoading: isStarting }] = useStartDirectConversationMutation();
  const [createGroup, { isLoading: isCreating }] = useCreateGroupConversationMutation();

  // Each opening starts afresh, in the mode it was opened for.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setMode(initialMode);
      setName("");
      setPeople([]);
    }
  }

  async function openDirect(person: PickedPerson) {
    try {
      const conversation = await start({ startDirectConversationCommand: { userId: person.userId } }).unwrap();
      onOpened(conversation.id);
    } catch (failure) {
      toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
    }
  }

  async function submitGroup() {
    try {
      const conversation = await createGroup({
        createGroupConversationCommand: { name: name.trim(), userIds: people.map((person) => person.userId) },
      }).unwrap();
      onOpened(conversation.id);
    } catch (failure) {
      toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
    }
  }

  const canCreate = name.trim() !== "" && people.length >= 2 && !isCreating;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Container size="md" placement="center" scroll="inside">
        <Modal.Dialog className="max-h-[min(40rem,calc(100dvh-2rem))]">
          <Modal.CloseTrigger aria-label={t("messages.close")} />
          <Modal.Header><Modal.Heading>{t(mode === "group" ? "messages.newGroup" : "messages.newTitle")}</Modal.Heading></Modal.Header>
          <Modal.Body className="flex min-h-0 flex-col gap-3">
            <Tabs selectedKey={mode} onSelectionChange={(key) => setMode(key as Mode)}>
              <Tabs.ListContainer>
                <Tabs.List aria-label={t("messages.newTitle")}>
                  <Tabs.Tab id="direct">{t("messages.tabDirect")}<Tabs.Indicator /></Tabs.Tab>
                  <Tabs.Tab id="group">{t("messages.tabGroup")}<Tabs.Indicator /></Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>

            {mode === "direct" ? (
              <PeoplePicker onPick={openDirect} exclude={myId ? [myId] : []} disabled={isStarting} />
            ) : (
              <>
                <TextField value={name} onChange={setName} maxLength={MAX_GROUP_NAME_LENGTH} variant="secondary">
                  <Label>{t("messages.groupName")}</Label>
                  <Input placeholder={t("messages.groupNamePlaceholder")} />
                </TextField>
                <PickedChips people={people} onRemove={(userId) => setPeople((current) => current.filter((p) => p.userId !== userId))} />
                <PeoplePicker
                  autoFocus={false}
                  selected={people}
                  exclude={myId ? [myId] : []}
                  onPick={(person) => setPeople((current) => togglePerson(current, person))}
                />
              </>
            )}
          </Modal.Body>
          {mode === "group" && (
            <Modal.Footer>
              <p className="me-auto text-xs text-muted">{t("messages.groupHint")}</p>
              <Button variant="secondary" onPress={onClose}>{t("messages.cancel")}</Button>
              <Button isDisabled={!canCreate} isPending={isCreating} onPress={() => void submitGroup()}>{t("messages.createGroup")}</Button>
            </Modal.Footer>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
