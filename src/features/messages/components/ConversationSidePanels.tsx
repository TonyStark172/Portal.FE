"use client";

import { useMemo, useState, type ReactNode } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { Alert, Button, Input, Modal, SearchField, Skeleton, Spinner, TextField, toast } from "@heroui/react";
import {
  ArrowLeft,
  ArrowRightFromSquare,
  Bell,
  BellSlash,
  File,
  Link,
  Magnifier,
  Pencil,
  PersonPlus,
  Picture,
  Pin,
  PinSlash,
  TrashBin,
  Xmark,
} from "@gravity-ui/icons";
import {
  useAddConversationMembersMutation,
  useClearConversationMutation,
  useGetPinnedChatMessagesQuery,
  useLeaveConversationMutation,
  useRemoveConversationMemberMutation,
  useRenameConversationMutation,
  useSetConversationMutedMutation,
  useUnpinChatMessageMutation,
  type ChatMessageDto,
  type ConversationDto,
} from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { useLoadMore } from "@/features/posts/hooks/useLoadMore";
import { useSearchChatMessagePagesInfiniteQuery } from "../api";
import { clockTime, listTime } from "../lib/messageTime";
import { excerptAround, highlightTerms, MIN_SEARCH_LENGTH, searchTerms } from "../lib/searchText";
import { attachmentsLabel, conversationName, isActiveNow, lastActiveLabel, memberName } from "../lib/messageText";
import { ConfirmAction } from "./ConfirmAction";
import { ConversationAvatar, PresenceDot } from "./ConversationAvatar";
import { MAX_GROUP_NAME_LENGTH } from "./NewConversationDialog";
import { PeoplePicker, PickedChips, togglePerson, useDebounced, type PickedPerson } from "./PeoplePicker";

/** The panels beside a conversation; "media", "files" and "links" are the tabs of what was shared. */
export type SidePanel = "info" | "pinned" | "search" | "media" | "files" | "links";

const fail = (failure: unknown, fallback: string) => toast.danger(toApiProblem(failure).detail ?? fallback);

/** A panel beside the conversation (over it on a phone): a title, a way back where it was opened from, and ✕. */
export function PanelFrame({ title, onBack, onClose, children, bodyClassName = "p-3" }: {
  title: string;
  onBack?: () => void;
  onClose: () => void;
  children: ReactNode;
  bodyClassName?: string;
}) {
  const { t } = useLocale();
  return (
    <aside className="absolute inset-0 z-20 flex flex-col bg-background md:static md:w-80 md:shrink-0 md:border-s md:border-separator">
      <header className="flex items-center gap-2 border-b border-separator px-3 py-2.5">
        {onBack && (
          <Button isIconOnly size="sm" variant="ghost" aria-label={t("messages.backToInfo")} onPress={onBack}>
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <h3 className="flex-1 text-sm font-semibold">{title}</h3>
        <Button isIconOnly size="sm" variant="ghost" aria-label={t("messages.close")} onPress={onClose}>
          <Xmark className="size-4" />
        </Button>
      </header>
      <div className={`min-h-0 flex-1 overflow-y-auto scrollbar ${bodyClassName}`}>{children}</div>
    </aside>
  );
}

/** A message in a side list (pinned, search results): who, when, what; pressing it takes to it in the conversation. */
function MessageRow({ message, conversation, myId, onOpen, end, terms }: {
  message: ChatMessageDto;
  conversation: ConversationDto;
  myId: number | undefined;
  onOpen: () => void;
  end?: ReactNode;
  /** The words a search found it by: marked in its text, which is cut around the first of them. */
  terms?: string[];
}) {
  const { t, locale } = useLocale();
  const sender = conversation.members.find((member) => member.userId === message.senderId);
  const text = message.kind === "Poll" ? `📊 ${message.content}` : message.content || attachmentsLabel(message.attachments.map((a) => a.kind), t);
  return (
    <li className="flex items-start gap-2 rounded-xl p-1.5 hover:bg-default">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus">
        <UserAvatar fullName={message.senderId === myId ? t("messages.you") : sender?.fullName} avatarUrl={message.senderId === myId ? null : sender?.avatarUrl} size="sm" />
        <span className="flex min-w-0 flex-col">
          <span className="text-xs text-muted">
            {memberName(message.senderId, conversation.members, myId, t)} · {listTime(message.sentAt, locale)} {clockTime(message.sentAt, locale)}
          </span>
          <span className="line-clamp-3 whitespace-pre-wrap break-words text-sm">
            {terms ? highlightTerms(excerptAround(text, terms), terms) : text}
          </span>
        </span>
      </button>
      {end}
    </li>
  );
}

export function PinnedPanel({ conversation, myId, onJumpTo, onClose }: {
  conversation: ConversationDto;
  myId: number | undefined;
  onJumpTo: (messageId: number) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const { currentData, isLoading } = useGetPinnedChatMessagesQuery({ id: conversation.id });
  const [unpin] = useUnpinChatMessageMutation();
  return (
    <PanelFrame title={t("messages.pinnedTitle")} onClose={onClose}>
      {isLoading && <Spinner size="sm" className="mx-auto" />}
      {currentData?.length === 0 && <p className="p-4 text-center text-sm text-muted">{t("messages.noPinned")}</p>}
      <ul className="flex flex-col gap-1">
        {currentData?.map((message) => (
          <MessageRow
            key={message.id}
            message={message}
            conversation={conversation}
            myId={myId}
            onOpen={() => onJumpTo(message.id)}
            end={
              <Button isIconOnly size="sm" variant="ghost" aria-label={t("messages.action.unpin")} onPress={() => unpin({ messageId: message.id }).unwrap().catch((f) => fail(f, t("common.genericError")))}>
                <PinSlash className="size-4" />
              </Button>
            }
          />
        ))}
      </ul>
    </PanelFrame>
  );
}

export function SearchPanel({ conversation, myId, onJumpTo, onClose }: {
  conversation: ConversationDto;
  myId: number | undefined;
  onJumpTo: (messageId: number) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [text, setText] = useState("");
  const typed = text.trim();
  // Asked for a moment after the typing stops; what was found for an earlier text stays in memory, so going back to it
  // (deleting a letter) shows it at once.
  const term = useDebounced(typed, 250);
  const enough = typed.length >= MIN_SEARCH_LENGTH;
  const { currentData, isError, refetch, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } =
    useSearchChatMessagePagesInfiniteQuery(term.length >= MIN_SEARCH_LENGTH ? { conversationId: conversation.id, text: term } : skipToken);
  const sentinel = useLoadMore({ hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage });
  const terms = useMemo(() => searchTerms(term), [term]);
  const results = useMemo(() => currentData?.pages.flatMap((page) => page.items), [currentData]);
  // On their way: the text changed and has not been asked for yet, or the answer has not come.
  const waiting = enough && (typed !== term || (results === undefined && !isError));

  return (
    <PanelFrame title={t("messages.searchTitle")} onClose={onClose}>
      <SearchField autoFocus aria-label={t("messages.searchInConversation")} value={text} onChange={setText} variant="secondary" fullWidth>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={t("messages.searchInConversation")} />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <div className="mt-2" aria-busy={waiting}>
        {typed !== "" && !enough && <p className="p-4 text-center text-sm text-muted">{t("messages.searchMinLength")}</p>}
        {waiting && <ResultSkeletons count={5} label={t("messages.searching")} />}
        {enough && !waiting && isError && results === undefined && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t("messages.searchError")}</Alert.Title>
            </Alert.Content>
            <Button size="sm" variant="secondary" onPress={() => void refetch()}>{t("common.retry")}</Button>
          </Alert>
        )}
        {enough && !waiting && results !== undefined && (
          <>
            <p className="px-1.5 pb-1 text-xs text-muted" role="status">
              {results.length === 0
                ? t("messages.noResults")
                : t(hasNextPage ? "messages.searchCountMore" : "messages.searchCount").replace("{count}", String(results.length))}
            </p>
            <ul className="flex flex-col gap-1">
              {results.map((message) => (
                <MessageRow key={message.id} message={message} conversation={conversation} myId={myId} terms={terms} onOpen={() => onJumpTo(message.id)} />
              ))}
            </ul>
            {/* While more remain the list ends in placeholders; reaching them reads the next page. */}
            {hasNextPage && !isFetchNextPageError && (
              <div ref={sentinel}>
                <ResultSkeletons count={2} label={t("messages.searching")} />
              </div>
            )}
            {isFetchNextPageError && !isFetchingNextPage && (
              <div className="flex items-center justify-center gap-3 py-2 text-sm text-muted">
                {t("messages.searchError")}
                <Button size="sm" variant="secondary" onPress={() => void fetchNextPage()}>{t("common.retry")}</Button>
              </div>
            )}
          </>
        )}
      </div>
    </PanelFrame>
  );
}

/** Rows in the shape of the results, while they are on their way. */
function ResultSkeletons({ count, label }: { count: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-1">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-start gap-2 p-1.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
            <Skeleton className="h-3 w-2/5 rounded-full" />
            <Skeleton className={`h-3.5 rounded-full ${i % 2 ? "w-3/5" : "w-11/12"}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PanelButton({ icon, children, onPress, danger = false }: { icon: ReactNode; children: ReactNode; onPress: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus ${danger ? "text-danger" : ""}`}
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-default [&>svg]:size-4">{icon}</span>
      {children}
    </button>
  );
}

/**
 * The conversation's details: who is in it (and who is active), muting, its pinned messages and a search; for a group
 * its name, adding and removing people and leaving it; deleting it on one's own side.
 */
export function InfoPanel({ conversation, myId, onOpenPanel, onLeft, onClose }: {
  conversation: ConversationDto;
  myId: number | undefined;
  onOpenPanel: (panel: SidePanel) => void;
  onLeft: () => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [setMuted] = useSetConversationMutedMutation();
  const [rename, { isLoading: isRenaming }] = useRenameConversationMutation();
  const [addMembers, { isLoading: isAdding }] = useAddConversationMembersMutation();
  const [removeMember, { isLoading: isRemoving }] = useRemoveConversationMemberMutation();
  const [leave, { isLoading: isLeaving }] = useLeaveConversationMutation();
  const [clear, { isLoading: isClearing }] = useClearConversationMutation();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState<PickedPerson[]>([]);
  const [confirm, setConfirm] = useState<"leave" | "clear" | { remove: number } | null>(null);

  const toggleMute = () =>
    setMuted({ id: conversation.id, setConversationMutedCommand: { muted: !conversation.isMuted } }).unwrap()
      .then(() => toast.success(t(conversation.isMuted ? "messages.unmuted" : "messages.muted")))
      .catch((failure) => fail(failure, t("common.genericError")));

  async function saveName() {
    try {
      await rename({ id: conversation.id, renameConversationCommand: { name: newName.trim() } }).unwrap();
      setRenaming(false);
    } catch (failure) {
      fail(failure, t("common.genericError"));
    }
  }

  async function saveMembers() {
    try {
      await addMembers({ id: conversation.id, addConversationMembersCommand: { userIds: toAdd.map((p) => p.userId) } }).unwrap();
      setAdding(false);
      setToAdd([]);
    } catch (failure) {
      fail(failure, t("common.genericError"));
    }
  }

  async function confirmed() {
    try {
      if (confirm === "leave") {
        await leave({ id: conversation.id }).unwrap();
        onLeft();
      } else if (confirm === "clear") {
        await clear({ id: conversation.id }).unwrap();
        onLeft();
      } else if (confirm) {
        await removeMember({ id: conversation.id, userId: confirm.remove }).unwrap();
      }
      setConfirm(null);
    } catch (failure) {
      fail(failure, t("common.genericError"));
    }
  }

  const removing = typeof confirm === "object" && confirm ? conversation.members.find((m) => m.userId === confirm.remove) : undefined;
  const partner = conversation.isGroup ? undefined : conversation.members[0];

  return (
    <PanelFrame title={t("messages.info")} onClose={onClose}>
      <div className="flex flex-col items-center gap-1 pb-3 text-center">
        <ConversationAvatar conversation={conversation} size="lg" />
        <p className="mt-1 font-semibold">{conversationName(conversation, t)}</p>
        {partner && <p className="text-xs text-muted">{partner.isActive ? lastActiveLabel(partner.lastActiveAt, t) : t("messages.deactivated")}</p>}
        {conversation.isGroup && <p className="text-xs text-muted">{t("messages.memberCount").replace("{count}", String(conversation.members.length + 1))}</p>}
      </div>

      <div className="flex flex-col gap-0.5">
        <PanelButton icon={conversation.isMuted ? <Bell /> : <BellSlash />} onPress={() => void toggleMute()}>
          {t(conversation.isMuted ? "messages.unmute" : "messages.mute")}
        </PanelButton>
        <PanelButton icon={<Magnifier />} onPress={() => onOpenPanel("search")}>{t("messages.searchTitle")}</PanelButton>
        <PanelButton icon={<Pin />} onPress={() => onOpenPanel("pinned")}>{t("messages.pinnedTitle")}</PanelButton>
        {conversation.isGroup && (
          <PanelButton icon={<Pencil />} onPress={() => { setNewName(conversation.name ?? ""); setRenaming(true); }}>{t("messages.renameGroup")}</PanelButton>
        )}
      </div>

      <section className="mt-3">
        <h4 className="mb-1 text-xs font-medium text-muted">{t("messages.sharedTitle")}</h4>
        <div className="flex flex-col gap-0.5">
          <PanelButton icon={<Picture />} onPress={() => onOpenPanel("media")}>{t("messages.sharedMedia")}</PanelButton>
          <PanelButton icon={<File />} onPress={() => onOpenPanel("files")}>{t("messages.sharedFiles")}</PanelButton>
          <PanelButton icon={<Link />} onPress={() => onOpenPanel("links")}>{t("messages.sharedLinks")}</PanelButton>
        </div>
      </section>

      {conversation.isGroup && (
        <section className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <h4 className="text-xs font-medium text-muted">{t("messages.members")}</h4>
            <Button size="sm" variant="ghost" onPress={() => setAdding(true)}>
              <PersonPlus className="size-4" /> {t("messages.addMembers")}
            </Button>
          </div>
          <ul className="flex flex-col gap-0.5">
            <li className="flex items-center gap-2 px-1 py-1 text-sm">
              <span className="text-muted">{t("messages.you")}</span>
              {conversation.isAdmin && <span className="rounded bg-default px-1.5 text-[0.625rem] text-muted">{t("messages.admin")}</span>}
            </li>
            {conversation.members.map((member) => (
              <li key={member.userId} className="flex items-center gap-2 rounded-xl px-1 py-1">
                <span className="relative inline-flex">
                  <UserAvatar fullName={member.fullName} avatarUrl={member.avatarUrl} size="sm" />
                  {member.isActive && isActiveNow(member.lastActiveAt) && <PresenceDot className="size-2.5" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{member.fullName}</span>
                  <span className="text-[0.6875rem] text-muted">
                    {member.isAdmin ? t("messages.admin") : member.isActive ? lastActiveLabel(member.lastActiveAt, t) ?? "" : t("messages.deactivated")}
                  </span>
                </span>
                {conversation.isAdmin && (
                  <Button isIconOnly size="sm" variant="ghost" aria-label={t("messages.removeMember").replace("{name}", member.fullName)} onPress={() => setConfirm({ remove: member.userId })}>
                    <Xmark className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-3 flex flex-col gap-0.5 border-t border-separator pt-3">
        {conversation.isGroup && (
          <PanelButton danger icon={<ArrowRightFromSquare />} onPress={() => setConfirm("leave")}>{t("messages.leaveGroup")}</PanelButton>
        )}
        <PanelButton danger icon={<TrashBin />} onPress={() => setConfirm("clear")}>{t("messages.clearConversation")}</PanelButton>
      </div>

      <Modal.Backdrop isOpen={renaming} onOpenChange={setRenaming}>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label={t("messages.close")} />
            <Modal.Header><Modal.Heading>{t("messages.renameGroup")}</Modal.Heading></Modal.Header>
            <Modal.Body>
              <TextField autoFocus value={newName} onChange={setNewName} maxLength={MAX_GROUP_NAME_LENGTH} variant="secondary" aria-label={t("messages.groupName")}>
                <Input placeholder={t("messages.groupNamePlaceholder")} />
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={() => setRenaming(false)}>{t("messages.cancel")}</Button>
              <Button isDisabled={newName.trim() === ""} isPending={isRenaming} onPress={() => void saveName()}>{t("messages.save")}</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop isOpen={adding} onOpenChange={(open) => { setAdding(open); if (!open) setToAdd([]); }}>
        <Modal.Container size="md" placement="center" scroll="inside">
          <Modal.Dialog className="max-h-[min(40rem,calc(100dvh-2rem))]">
            <Modal.CloseTrigger aria-label={t("messages.close")} />
            <Modal.Header><Modal.Heading>{t("messages.addMembers")}</Modal.Heading></Modal.Header>
            <Modal.Body className="flex min-h-0 flex-col gap-2">
              <PickedChips people={toAdd} onRemove={(userId) => setToAdd((current) => current.filter((p) => p.userId !== userId))} />
              <PeoplePicker
                selected={toAdd}
                exclude={[...(myId ? [myId] : []), ...conversation.members.map((m) => m.userId)]}
                onPick={(person) => setToAdd((current) => togglePerson(current, person))}
              />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={() => setAdding(false)}>{t("messages.cancel")}</Button>
              <Button isDisabled={toAdd.length === 0} isPending={isAdding} onPress={() => void saveMembers()}>{t("messages.add")}</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {confirm && (
        <ConfirmAction
          title={t(confirm === "leave" ? "messages.leaveGroup" : confirm === "clear" ? "messages.clearConversation" : "messages.removeMemberTitle")}
          message={
            confirm === "leave"
              ? t("messages.leaveConfirm")
              : confirm === "clear"
                ? t("messages.clearConfirm")
                : t("messages.removeConfirm").replace("{name}", removing?.fullName ?? "")
          }
          confirmLabel={t(confirm === "leave" ? "messages.leave" : confirm === "clear" ? "messages.delete" : "messages.remove")}
          isPending={isLeaving || isClearing || isRemoving}
          onConfirm={() => void confirmed()}
          onClose={() => setConfirm(null)}
        />
      )}
    </PanelFrame>
  );
}
