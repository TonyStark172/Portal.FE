"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { useStore } from "react-redux";
import { Button, Tooltip, toast } from "@heroui/react";
import { ArrowUturnCcwLeft, ChartColumn, FaceSmile, Paperclip, PaperPlane, Pencil, Xmark } from "@gravity-ui/icons";
import { FileFormatIcon } from "@/features/posts/components/AttachmentList";
import {
  useEditChatMessageMutation,
  useSendChatMessageMutation,
  type ChatAttachmentDto,
  type ChatMessageDto,
  type ConversationMemberDto,
  type PostFileKind,
} from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { uploadProtected } from "@/shared/api/uploadProtected";
import { useLocale } from "@/shared/i18n";
import type { SessionState } from "@/shared/session/sessionSlice";
import { attachmentsLabel, LIKE, memberName } from "../lib/messageText";
import { useTypingNotifier } from "../hooks/useTyping";
import { CreatePollDialog } from "./CreatePollDialog";
import { EmojiPopover } from "./EmojiPopover";

/** The same limits as Portal.BE's ConversationRules and PostFileRules. */
export const MAX_MESSAGE_LENGTH = 4000;
const MAX_ATTACHMENTS = 10;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const FILE_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".zip"];
const MAX_SIZE: Record<PostFileKind, number> = { Image: 5 << 20, Video: 100 << 20, Attachment: 20 << 20 };
const ACCEPT = [...IMAGE_TYPES, ...VIDEO_TYPES, ...FILE_EXTENSIONS].join(",");

type Upload = { key: number; file: File; kind: PostFileKind; progress: number; preview?: string; uploaded?: ChatAttachmentDto; failed?: boolean };

function kindOf(file: File): PostFileKind | null {
  if (IMAGE_TYPES.includes(file.type)) return "Image";
  if (VIDEO_TYPES.includes(file.type)) return "Video";
  const dot = file.name.lastIndexOf(".");
  return dot >= 0 && FILE_EXTENSIONS.includes(file.name.slice(dot).toLowerCase()) ? "Attachment" : null;
}

/**
 * The box at the bottom of a conversation: text (Enter sends, Shift+Enter a new line), emoji, files uploaded as soon as
 * they are picked or pasted, the message answered or being edited above it, and 👍 when nothing is written.
 */
export function MessageComposer({ conversationId, members, myId, canWrite, replyTo, editing, onCancelReply, onCancelEdit, onSent, focusKey }: {
  conversationId: number;
  members: ConversationMemberDto[];
  myId: number | undefined;
  canWrite: boolean;
  replyTo: ChatMessageDto | null;
  editing: ChatMessageDto | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSent: (message: ChatMessageDto) => void;
  /** Changes whenever the box should take the focus (a reply or an edit was chosen). */
  focusKey: unknown;
}) {
  const { t } = useLocale();
  const store = useStore<{ session: SessionState }>();
  const [draft, setDraft] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [sending, setSending] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const nextKey = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [send] = useSendChatMessageMutation();
  const [edit] = useEditChatMessageMutation();
  const notifyTyping = useTypingNotifier(conversationId);

  // Editing puts the message's text in the box; leaving the edit empties it again.
  const [editingId, setEditingId] = useState<number | null>(null);
  if ((editing?.id ?? null) !== editingId) {
    setEditingId(editing?.id ?? null);
    setDraft(editing ? editing.content : "");
  }

  useEffect(() => input.current?.focus(), [focusKey]);

  // Object URLs of image previews are let go when their upload leaves the box, and all of them with the box.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const all = previews.current;
    return () => all.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  const release = (gone: Upload[]) =>
    gone.forEach((upload) => {
      if (!upload.preview) return;
      URL.revokeObjectURL(upload.preview);
      previews.current.delete(upload.preview);
    });

  function addFiles(files: File[]) {
    if (editing) return;
    const room = MAX_ATTACHMENTS - uploads.length;
    if (files.length > room) toast.warning(t("messages.tooManyFiles").replace("{count}", String(MAX_ATTACHMENTS)));
    for (const file of files.slice(0, Math.max(0, room))) {
      const kind = kindOf(file);
      if (!kind) {
        toast.danger(t("messages.fileNotAllowed").replace("{name}", file.name));
        continue;
      }
      if (file.size > MAX_SIZE[kind]) {
        toast.danger(t("messages.fileTooLarge").replace("{name}", file.name).replace("{size}", String(MAX_SIZE[kind] >> 20)));
        continue;
      }
      const key = nextKey.current++;
      const preview = kind === "Image" ? URL.createObjectURL(file) : undefined;
      if (preview) previews.current.add(preview);
      setUploads((current) => [...current, { key, file, kind, progress: 0, preview }]);
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      uploadProtected<ChatAttachmentDto>(store, "/api/Conversations/attachments", form, {
        onProgress: (sent) => setUploads((current) => current.map((u) => (u.key === key ? { ...u, progress: sent } : u))),
      })
        .then((uploaded) => setUploads((current) => current.map((u) => (u.key === key ? { ...u, uploaded, progress: 1 } : u))))
        .catch((failure) => {
          setUploads((current) => current.map((u) => (u.key === key ? { ...u, failed: true } : u)));
          toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
        });
    }
  }

  const removeUpload = (key: number) => {
    release(uploads.filter((u) => u.key === key));
    setUploads((current) => current.filter((u) => u.key !== key));
  };
  const uploading = uploads.some((u) => !u.uploaded && !u.failed);
  const ready = uploads.filter((u) => u.uploaded);

  async function submit(content = draft.trim()) {
    if (sending || uploading) return;
    if (editing) {
      if (!content && editing.attachments.length === 0) return;
      setSending(true);
      try {
        await edit({ messageId: editing.id, editChatMessageCommand: { content } }).unwrap();
        onCancelEdit();
      } catch (failure) {
        toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
      } finally {
        setSending(false);
      }
      return;
    }
    if (!content && ready.length === 0) return;
    setSending(true);
    const sentUploads = uploads;
    setDraft("");
    setUploads([]);
    try {
      const message = await send({
        id: conversationId,
        sendChatMessageCommand: {
          content,
          replyToId: replyTo?.id ?? null,
          attachmentIds: sentUploads.filter((u) => u.uploaded).map((u) => u.uploaded!.id),
        },
      }).unwrap();
      release(sentUploads);
      onCancelReply();
      onSent(message);
    } catch (failure) {
      setDraft((current) => current || content);
      setUploads((current) => (current.length ? current : sentUploads));
      toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
    } finally {
      setSending(false);
      input.current?.focus();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Not while an input method (Vietnamese Telex, for one) is still composing a letter.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    } else if (event.key === "Escape") {
      if (editing) onCancelEdit();
      else if (replyTo) onCancelReply();
    }
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files);
    if (files.length === 0) return;
    event.preventDefault();
    addFiles(files);
  }

  if (!canWrite) return <p className="border-t border-separator p-3 text-center text-sm text-muted">{t("messages.cannotReply")}</p>;

  const empty = draft.trim() === "" && uploads.length === 0;

  return (
    <div
      className="border-t border-separator"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        addFiles(Array.from(event.dataTransfer.files));
      }}
    >
      {(replyTo || editing) && (
        <div className="flex items-start gap-2 px-3 pt-2 text-xs">
          {editing ? <Pencil className="mt-0.5 size-3.5 shrink-0 text-muted" /> : <ArrowUturnCcwLeft className="mt-0.5 size-3.5 shrink-0 text-muted" />}
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {editing ? t("messages.editing") : t("messages.replyingTo").replace("{name}", memberName(replyTo!.senderId, members, myId, t))}
            </p>
            {replyTo && (
              <p className="truncate text-muted">{replyTo.content || attachmentsLabel(replyTo.attachments.map((a) => a.kind), t)}</p>
            )}
          </div>
          <Button isIconOnly size="sm" variant="ghost" aria-label={t("messages.cancel")} className="size-6 min-w-6" onPress={editing ? onCancelEdit : onCancelReply}>
            <Xmark className="size-3.5" />
          </Button>
        </div>
      )}

      {uploads.length > 0 && (
        <ul className="flex gap-2 overflow-x-auto px-3 pt-2">
          {uploads.map((upload) => (
            <li key={upload.key} className="relative shrink-0">
              {upload.preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local preview (object URL) of the picked file
                <img src={upload.preview} alt={upload.file.name} className="size-16 rounded-lg object-cover" />
              ) : (
                <span className="flex h-16 w-40 items-center gap-2 rounded-lg bg-default px-2">
                  <FileFormatIcon fileName={upload.file.name} />
                  <span className="line-clamp-2 text-xs">{upload.file.name}</span>
                </span>
              )}
              {!upload.uploaded && !upload.failed && (
                <span className="absolute inset-x-1 bottom-1 h-1 overflow-hidden rounded-full bg-black/30">
                  <span className="block h-full bg-accent" style={{ width: `${Math.round(upload.progress * 100)}%` }} />
                </span>
              )}
              {upload.failed && <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-danger/40 text-xs text-white">{t("messages.uploadFailed")}</span>}
              <button
                type="button"
                aria-label={t("messages.removeFile").replace("{name}", upload.file.name)}
                onClick={() => removeUpload(upload.key)}
                className="absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
              >
                <Xmark className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex items-end gap-1 p-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {!editing && (
          <>
            <input ref={picker} type="file" multiple accept={ACCEPT} hidden onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }} />
            <Tooltip delay={400}>
              <Button isIconOnly size="sm" variant="ghost" aria-label={t("messages.attach")} onPress={() => picker.current?.click()}>
                <Paperclip className="size-4" />
              </Button>
              <Tooltip.Content>{t("messages.attach")}</Tooltip.Content>
            </Tooltip>
            <Tooltip delay={400}>
              <Button isIconOnly size="sm" variant="ghost" aria-label={t("messages.poll.create")} onPress={() => setPollOpen(true)}>
                <ChartColumn className="size-4" />
              </Button>
              <Tooltip.Content>{t("messages.poll.create")}</Tooltip.Content>
            </Tooltip>
            <CreatePollDialog conversationId={conversationId} isOpen={pollOpen} onClose={() => setPollOpen(false)} onCreated={onSent} />
          </>
        )}
        <div className="relative flex min-w-0 flex-1 items-end rounded-2xl bg-default">
          <textarea
            ref={input}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (event.target.value) notifyTyping();
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            aria-label={t("messages.placeholder")}
            placeholder={t("messages.placeholder")}
            className="max-h-36 min-h-9 flex-1 resize-none bg-transparent px-3.5 py-2 text-sm text-foreground outline-none [field-sizing:content] placeholder:text-muted"
          />
          <EmojiPopover
            placement="top end"
            onPick={(emoji) => {
              const field = input.current;
              const start = field?.selectionStart ?? draft.length;
              const end = field?.selectionEnd ?? draft.length;
              setDraft(draft.slice(0, start) + emoji + draft.slice(end));
              requestAnimationFrame(() => {
                field?.focus();
                field?.setSelectionRange(start + emoji.length, start + emoji.length);
              });
            }}
            trigger={
              <Button isIconOnly size="sm" variant="ghost" aria-label={t("posts.emoji.insert")} className="mb-0.5 me-0.5">
                <FaceSmile className="size-4" />
              </Button>
            }
          />
        </div>
        {empty && !editing ? (
          <Button isIconOnly variant="ghost" aria-label={t("messages.sendLike")} isDisabled={sending} onPress={() => void submit(LIKE)} className="text-xl">
            {LIKE}
          </Button>
        ) : (
          <Button type="submit" isIconOnly aria-label={editing ? t("messages.saveEdit") : t("messages.send")} isDisabled={sending || uploading}>
            <PaperPlane className="size-4" />
          </Button>
        )}
      </form>
    </div>
  );
}
