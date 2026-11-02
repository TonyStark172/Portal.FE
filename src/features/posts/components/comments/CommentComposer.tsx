"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Picture, Xmark } from "@gravity-ui/icons";
import { Button, Tooltip, toast } from "@heroui/react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  useCreatePostCommentMutation,
  useUpdatePostCommentMutation,
  type PostAuthorDto,
  type PostCommentDto,
  type PostDto,
  type PostMediaDto,
} from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { commentExtensions, commentTextOf, MAX_COMMENT_LENGTH } from "../../editor/commentExtensions";
import { useAlbum, type AlbumItem } from "../../hooks/useAlbum";
import { useColleagueMentions } from "../../hooks/useColleagueMentions";
import { commentDrafts, type CommentDraft } from "../../lib/commentDrafts";
import { mediaError } from "../../lib/fileRules";
import { DraftThumb } from "../composer/DraftThumb";
import { EmojiButton } from "../composer/EmojiButton";
import { MediaDropZone } from "../composer/MediaDropZone";

/** What the comments popup asks of the box: to answer a comment, to change one of the reader's own, to let go of one deleted. */
export type CommentComposerHandle = {
  reply: (target: PostCommentDto) => void;
  edit: (comment: PostCommentDto) => void;
  commentDeleted: (id: number) => void;
};

/** How many animation frames a comment just sent is waited for (the list draws it once the cache has it). */
const SCROLL_FRAMES = 30;

const mediaOf = (item: AlbumItem): PostMediaDto => ({
  id: item.fileId!,
  kind: item.kind,
  fileName: item.name,
  contentType: item.source?.type ?? "",
  size: item.source?.size ?? 0,
  caption: null,
});

/** Keeps the draft of a post, or drops it when there is nothing in it. */
function remember(postId: number, draft: CommentDraft) {
  if (draft.html === "" && !draft.file && !draft.replyTo) commentDrafts.clear(postId);
  else commentDrafts.set(postId, draft);
}

/**
 * The box at the bottom of the comments popup: one editor for a new comment, a reply or an edit, with @mentions, emoji
 * and one image or video. What is unsent stays with the post until the page is loaded again. Mount it once per post
 * (`key={post.id}`): its draft is read when it mounts and saved when it goes.
 */
export const CommentComposer = forwardRef<CommentComposerHandle, { post: PostDto }>(function CommentComposer({ post }, ref) {
  const { t } = useLocale();
  const [create, { isLoading: isCreating }] = useCreatePostCommentMutation();
  const [update, { isLoading: isUpdating }] = useUpdatePostCommentMutation();
  const isSending = isCreating || isUpdating;

  const [draft] = useState(() => commentDrafts.get(post.id));
  const [replyTo, setReplyTo] = useState<PostCommentDto | null>(draft?.replyTo ?? null);
  // The comment being changed. The draft waits in `commentDrafts` meanwhile, and comes back after.
  const [editing, setEditing] = useState<PostCommentDto | null>(null);
  const [sendFailed, setSendFailed] = useState(false);
  const [isDropZoneOpen, setDropZoneOpen] = useState(false);
  const album = useAlbum(draft?.file ? [draft.file] : undefined, () => setSendFailed(false));
  const item = album.items[0];
  const file = item?.status === "done" && item.fileId ? mediaOf(item) : null;

  const frame = useRef<HTMLDivElement>(null);
  const notice = useRef<HTMLParagraphElement>(null);
  // Set at once on send, where state would lag behind a second Enter.
  const isSendingRef = useRef(false);
  const placeholder = useRef("");
  // The editor is configured once: its Enter reaches the current `send` through this.
  const sendRef = useRef(() => {});

  const mentionSuggestion = useColleagueMentions(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: commentExtensions({
      placeholder: () => placeholder.current,
      mentionSuggestion,
      onSubmit: () => sendRef.current(),
    }),
    content: draft?.html ?? "",
    editorProps: {
      attributes: () => ({ class: "post-content min-h-6 outline-none", "aria-label": placeholder.current, spellcheck: "false" }),
    },
    onUpdate: () => setSendFailed(false),
  });
  const written = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? { html: e.isEmpty ? "" : e.getHTML(), text: commentTextOf(e.state.doc) } : null),
  });
  const text = written?.text ?? "";

  const isOff = post.commentsDisabled && !editing;
  const isTooLong = text.length > MAX_COMMENT_LENGTH;
  const isSendable = (written: string) =>
    (written.trim().length > 0 || album.hasMedia) && written.length <= MAX_COMMENT_LENGTH && !album.isUploading && !album.hasFailed;
  const canSend = !!editor && isSendable(text);

  const hint = post.commentCount === 0 && !replyTo && !editing ? t("posts.comments.writeFirst") : t("posts.comments.write");
  useEffect(() => {
    placeholder.current = hint;
    // The hint is drawn with the text: the editor is asked to draw again.
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr);
  }, [hint, editor]);

  // The cursor goes into the box when the popup opens, unless comments are off, and into an edit as it starts.
  const hasFocused = useRef(false);
  useEffect(() => {
    if (!editor || isOff || hasFocused.current) return;
    hasFocused.current = true;
    editor.commands.focus("end");
  }, [editor, isOff]);
  useEffect(() => {
    if (editing && editor) editor.commands.focus("end");
  }, [editing, editor]);

  // Closing the popup (the box goes) keeps what is unsent, but not an upload still going: only a finished file is kept.
  // An edit is not kept: its draft was put away when it began.
  const latest = useRef<{ postId: number; draft: CommentDraft | null; isEditing: boolean }>({ postId: post.id, draft: null, isEditing: false });
  useEffect(() => {
    latest.current = {
      postId: post.id,
      draft: written ? { html: written.html, file, replyTo } : null,
      isEditing: editing !== null,
    };
  });
  useEffect(
    () => () => {
      const { postId, draft: unsent, isEditing } = latest.current;
      if (unsent && !isEditing) remember(postId, unsent);
    },
    [],
  );

  /** New text for the box, which undo does not go back past: the text of an edit, of a draft, or none after a send. */
  function replaceContent(html: string) {
    editor?.chain().setMeta("addToHistory", false).setContent(html).run();
  }

  /** Puts a draft in the box (an empty one when there is none), as when an edit ends. */
  function load(saved: CommentDraft | undefined) {
    replaceContent(saved?.html ?? "");
    setSendFailed(false);
    album.reset(saved?.file ? [saved.file] : []);
    setReplyTo(saved?.replyTo ?? null);
    setEditing(null);
    setDropZoneOpen(false);
  }

  /** Takes the mention of `author` off the front of the text, if it is there (what a reply to a reply began with). */
  function dropMention(author: PostAuthorDto | null | undefined) {
    const first = editor?.state.doc.firstChild?.firstChild;
    if (!editor || !author || first?.type.name !== "mention" || first.attrs.id !== String(author.id)) return;
    const hasSpace = editor.state.doc.textBetween(2, 3) === " ";
    editor.commands.deleteRange({ from: 1, to: hasSpace ? 3 : 2 });
  }

  function reply(target: PostCommentDto) {
    if (!editor || post.commentsDisabled || isSendingRef.current) return;
    const previous = editing ? commentDrafts.get(post.id)?.replyTo : replyTo;
    if (editing) load(commentDrafts.get(post.id));
    // Replying to a reply begins with the mention of its author; a new target takes the place of the last one's.
    if (previous?.parentId != null) dropMention(previous.author);
    setReplyTo(target);
    if (target.parentId != null && target.author) {
      editor.commands.insertContentAt(1, [
        { type: "mention", attrs: { id: String(target.author.id), label: target.author.fullName } },
        { type: "text", text: " " },
      ]);
    }
    editor.commands.focus("end");
  }

  function edit(comment: PostCommentDto) {
    if (!editor || isSendingRef.current) return;
    if (!editing) remember(post.id, { html: written?.html ?? "", file, replyTo });
    setEditing(comment);
    setReplyTo(null);
    setDropZoneOpen(false);
    setSendFailed(false);
    replaceContent(comment.contentHtml);
    album.reset(comment.file ? [comment.file] : []);
  }

  function dropReply() {
    if (replyTo?.parentId != null) dropMention(replyTo.author);
    setReplyTo(null);
    setSendFailed(false);
  }

  function cancelReply() {
    dropReply();
    editor?.commands.focus("end");
  }

  function cancelEdit() {
    load(commentDrafts.get(post.id));
    editor?.commands.focus("end");
  }

  // With comments off there is no editor to focus: the notice takes it, in the next frame as the editor does (a dialog
  // over the popup that is just going would pull it back).
  function focus() {
    if (notice.current) requestAnimationFrame(() => notice.current?.focus());
    else editor?.commands.focus("end");
  }

  // Comment `id` is gone, and the focus with its row: the box takes it, no longer aimed at that comment. Drawn at once
  // when an edit ends, as that can leave the notice in its place.
  function commentDeleted(id: number) {
    const saved = commentDrafts.get(post.id);
    if (saved?.replyTo?.id === id) remember(post.id, { ...saved, replyTo: null });
    if (editing?.id === id) flushSync(() => load(commentDrafts.get(post.id)));
    else if (replyTo?.id === id) dropReply();
    focus();
  }

  useImperativeHandle(ref, () => ({ reply, edit, commentDeleted }));

  function pick(picked: File) {
    const error = mediaError(picked);
    if (error) {
      toast.danger(error);
      return;
    }
    // One file at a time: the new one takes the place of the last.
    if (item) album.remove(item.key);
    album.add([picked]);
    setDropZoneOpen(false);
  }

  function scrollTo(id: number) {
    let frames = 0;
    const look = () => {
      const row = frame.current?.closest(".comments-body")?.querySelector(`[data-comment-id="${id}"]`);
      if (row) row.scrollIntoView({ block: "nearest" });
      else if (++frames < SCROLL_FRAMES) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }

  async function send() {
    if (!editor || isSendingRef.current || !isSendable(commentTextOf(editor.state.doc))) return;
    isSendingRef.current = true;
    setSendFailed(false);
    // Frozen until the answer comes: what is typed, asked or picked meanwhile would be lost with the text sent.
    editor.setEditable(false);

    const contentHtml = editor.isEmpty ? "" : editor.getHTML();
    const fileId = album.toInput()[0]?.id ?? null;
    try {
      if (editing) {
        await update({ id: editing.id, updatePostCommentCommand: { contentHtml, fileId } }).unwrap();
        if (editor.isDestroyed) return; // the popup was closed meanwhile
        editor.setEditable(true);
        load(commentDrafts.get(post.id));
        editor.commands.focus("end");
      } else {
        const sent = await create({
          postId: post.id,
          createPostCommentCommand: { parentId: replyTo?.id ?? null, contentHtml, fileId },
        }).unwrap();
        if (editor.isDestroyed) return;
        editor.setEditable(true);
        replaceContent("");
        album.reset([]);
        setReplyTo(null);
        setDropZoneOpen(false);
        commentDrafts.clear(post.id);
        editor.commands.focus();
        scrollTo(sent.id);
      }
    } catch {
      if (editor.isDestroyed) return;
      // The text and the file stay for another try.
      editor.setEditable(true);
      editor.commands.focus();
      setSendFailed(true);
    } finally {
      isSendingRef.current = false;
    }
  }
  useEffect(() => {
    sendRef.current = () => void send();
  });

  if (isOff) {
    return (
      <p ref={notice} tabIndex={-1} role="status" className="px-4 py-4 text-center text-sm text-muted outline-none">
        {t("posts.comments.disabledNotice")}
      </p>
    );
  }

  return (
    <div ref={frame} className="flex flex-col gap-2 p-3">
      {isDropZoneOpen && <MediaDropZone multiple={false} isDisabled={isSending} onFiles={(files) => pick(files[0])} />}

      {(replyTo || editing) && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="min-w-0 flex-1 truncate">
            {editing ? t("posts.comments.editing") : t("posts.comments.replyingTo").replace("{name}", replyTo?.author?.fullName ?? "")}
          </span>
          <Button size="sm" variant="ghost" className="tap-target h-7 min-w-0 px-2 text-xs" isDisabled={isSending} onPress={editing ? cancelEdit : cancelReply}>
            {t("posts.comments.cancel")}
          </Button>
        </div>
      )}

      {item && (
        <div className="relative max-h-40 w-44 overflow-hidden rounded-xl">
          <DraftThumb item={item} isSingle onRetry={() => album.retry(item.key)} />
          <Button
            isIconOnly
            size="sm"
            variant="secondary"
            aria-label={t("posts.comments.removeMedia")}
            isDisabled={isSending}
            className="absolute end-1 top-1 z-20 rounded-full shadow-md"
            onPress={() => album.remove(item.key)}
          >
            <Xmark className="size-4" />
          </Button>
        </div>
      )}

      <div className="comment-editor rounded-xl bg-default px-3 py-2 focus-within:ring-2 focus-within:ring-focus">
        <EditorContent editor={editor} className="max-h-32 scrollbar overflow-y-auto" />
      </div>

      {isTooLong && <p className="text-sm text-danger">{t("posts.comments.tooLong").replace("{max}", String(MAX_COMMENT_LENGTH))}</p>}
      {sendFailed && (
        <p role="alert" className="text-sm text-danger">
          {t("posts.comments.sendFailed")}
        </p>
      )}

      <div className="flex items-center gap-1">
        <EmojiButton onPick={(emoji) => !isSendingRef.current && editor?.chain().focus().insertContent(emoji).run()} />
        <Tooltip delay={400}>
          <Button isIconOnly size="sm" variant="ghost" aria-label={t("posts.comments.addMedia")} isDisabled={isSending} onPress={() => setDropZoneOpen((open) => !open)}>
            <Picture className="size-4" />
          </Button>
          <Tooltip.Content>{t("posts.comments.addMedia")}</Tooltip.Content>
        </Tooltip>
        <span className="flex-1" />
        <Button size="sm" isDisabled={!canSend} isPending={isSending} onPress={() => void send()}>
          {t("posts.comments.send")}
        </Button>
      </div>
    </div>
  );
});
