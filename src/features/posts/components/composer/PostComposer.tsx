"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, Picture, Xmark } from "@gravity-ui/icons";
import { Alert, AlertDialog, Button, Label, Separator, Switch, Tooltip, toast } from "@heroui/react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { useCurrentUser } from "@/features/auth";
import { Permissions } from "@/shared/auth/permissions";
import {
  useCreatePostMutation,
  useGetMyProfileQuery,
  useUpdatePostMutation,
  type CreatePostCommand,
  type PostDto,
} from "@/shared/api/generated/portalApi";
import { ErrorCodes, toApiProblem, type ApiProblem } from "@/shared/api/problem";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { useLocale } from "@/shared/i18n";
import { useUploadPostFileMutation } from "../../api";
import {
  FontFamily,
  Highlight,
  PostMention,
  TextAlign,
  TextColor,
  TextSize,
} from "../../editor/extensions";
import { DEFAULT_BANNER_COLOR, type BannerColor } from "../../editor/palette";
import { addPreview, revokePreviews } from "../../editor/previews";
import { tableExtensions } from "../../editor/tableExtensions";
import {
  ATTACHMENT_EXTENSIONS,
  IMAGE_TYPES,
  MAX_ATTACHMENTS,
  VIDEO_TYPES,
  attachmentError,
  attachmentFilesOf,
  imageError,
  mediaFilesOf,
} from "../../lib/fileRules";
import { useAlbum } from "../../hooks/useAlbum";
import { useColleagueMentions } from "../../hooks/useColleagueMentions";
import { useFileUploads } from "../../hooks/useFileUploads";
import { FileUploadItem } from "./FileUploadItem";
import { AlbumEditor } from "./AlbumEditor";
import { AlbumPreview } from "./AlbumPreview";
import { BannerEditor, type BannerImage } from "./BannerEditor";
import { EmojiButton } from "./EmojiButton";
import { MediaDropZone } from "./MediaDropZone";
import { TableHandles } from "./TableHandles";
import { Toolbar } from "./Toolbar";

type PostComposerProps = {
  /** The post to edit; a new post when omitted. */
  post?: PostDto;
  /** Called after posting, or when the author closes the composer. */
  onDone: () => void;
  /** Told whether something has been written, as it changes (a folded-away composer keeps its draft). */
  onDirtyChange?: (dirty: boolean) => void;
};

/** The composer of a post, like the "New post" box of a Teams channel. */
export function PostComposer({ post, onDone, onDirtyChange }: PostComposerProps) {
  const { t } = useLocale();
  const { user, hasPermission } = useCurrentUser();
  // Only moderators may tag the whole company (Portal.BE drops the tag for anyone else).
  const canMentionEveryone = hasPermission(Permissions.Posts.Manage);
  const { data: profile } = useGetMyProfileQuery(undefined, { skip: !user });
  const [upload] = useUploadPostFileMutation();
  const [createPost, { isLoading: isCreating }] = useCreatePostMutation();
  const [updatePost, { isLoading: isUpdating }] = useUpdatePostMutation();

  const [isAnnouncement, setAnnouncement] = useState(post?.kind === "Announcement");
  const [subject, setSubject] = useState(post?.subject ?? "");
  const [subhead, setSubhead] = useState(post?.subhead ?? "");
  const [bannerColor, setBannerColor] = useState<BannerColor>(
    (post?.bannerColor as BannerColor | null | undefined) ?? DEFAULT_BANNER_COLOR,
  );
  const [bannerImage, setBannerImage] = useState<BannerImage | null>(
    post?.bannerImageId ? { id: post.bannerImageId, previewId: null, uploading: false } : null,
  );
  const [commentsAllowed, setCommentsAllowed] = useState(true);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [isDirty, setDirty] = useState(false);
  const [isDiscardOpen, setDiscardOpen] = useState(false);
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);
  const [isAlbumOpen, setAlbumOpen] = useState(false);
  const [isDropZoneOpen, setDropZoneOpen] = useState(false);
  const album = useAlbum(post?.media, () => setDirty(true));
  const attachments = useFileUploads(post?.attachments ?? [], () => setDirty(true));

  const mediaInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const editorFrame = useRef<HTMLDivElement>(null);
  const previewIds = useRef(new Set<string>());
  // The editor is configured once; pasted or dropped files reach the current album through this.
  const addMediaRef = useRef<(files: File[]) => void>(() => {});
  const addAttachmentsRef = useRef<(files: File[]) => void>(() => {});
  /** Whether a paste or drop carried files: images and videos go to the album, others are attached. */
  const takeFiles = (data: DataTransfer | null) => {
    const media = mediaFilesOf(data);
    const others = attachmentFilesOf(data);
    if (media.length > 0) addMediaRef.current(media);
    if (others.length > 0) addAttachmentsRef.current(others);
    return media.length + others.length > 0;
  };

  const mentionSuggestion = useColleagueMentions(canMentionEveryone);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Placeholder.configure({ placeholder: t("posts.composer.placeholder") }),
      TextColor,
      TextSize,
      FontFamily,
      Highlight,
      TextAlign,
      PostMention.configure({ suggestion: mentionSuggestion }),
      ...tableExtensions,
    ],
    content: post?.contentHtml ?? "",
    editorProps: {
      attributes: {
        class: "post-content min-h-28 px-1 py-2 outline-none",
        "aria-label": t("posts.composer.content"),
        spellcheck: "false",
      },
      handlePaste: (_view, event) => takeFiles(event.clipboardData),
      handleDrop: (_view, event) => {
        if (!takeFiles(event.dataTransfer)) return false;
        event.preventDefault();
        return true;
      },
    },
    onUpdate: () => setDirty(true),
  });

  const hasText = useEditorState({ editor, selector: ({ editor: e }) => (e?.getText().trim().length ?? 0) > 0 }) ?? false;

  useEffect(() => {
    addMediaRef.current = album.add;
    addAttachmentsRef.current = addAttachments;
  });

  // Local previews are released when the composer closes.
  useEffect(() => {
    const ids = previewIds.current;
    return () => revokePreviews(ids);
  }, []);

  function addAttachments(files: File[]) {
    const room = MAX_ATTACHMENTS - attachments.items.length;
    if (files.length > room) toast.danger(t("posts.composer.tooManyAttachments").replace("{max}", String(MAX_ATTACHMENTS)));

    const accepted = files.slice(0, Math.max(room, 0)).filter((file) => {
      const error = attachmentError(file, t);
      if (error) toast.danger(error);
      return !error;
    });
    attachments.add(accepted);
  }

  async function pickBannerImage(file: File) {
    const error = imageError(file, t);
    if (error) {
      toast.danger(error);
      return;
    }
    const previewId = addPreview(file);
    previewIds.current.add(previewId);
    setBannerImage({ id: null, previewId, uploading: true });
    setDirty(true);
    try {
      const uploaded = await upload({ file, kind: "Image" }).unwrap();
      setBannerImage((current) => (current?.previewId === previewId ? { ...current, id: uploaded.id, uploading: false } : current));
    } catch (error) {
      setBannerImage((current) => (current?.previewId === previewId ? null : current));
      toast.danger(toApiProblem(error).detail ?? t("posts.composer.bannerUploadError"));
    }
  }

  const isUploading =
    album.isUploading || attachments.isUploading || Boolean(bannerImage?.uploading);
  const doneAttachments = attachments.items.filter((a) => a.status === "done" && a.file);
  // A failed file is still listed, so posting without it would surprise the author: retry or remove it first.
  const hasFailedFile = album.hasFailed || attachments.hasFailed;
  const hasSubject = subject.trim().length > 0;
  const hasContent = hasText || album.hasMedia || doneAttachments.length > 0 || (isAnnouncement && hasSubject);
  const canSubmit =
    !isUploading && !hasFailedFile && hasContent && (!isAnnouncement || hasSubject) && !isCreating && !isUpdating;

  async function submit() {
    if (!editor || !canSubmit) return;
    setProblem(null);

    const body: Omit<CreatePostCommand, "commentsDisabled"> = {
      kind: isAnnouncement ? "Announcement" : "Normal",
      subject: subject.trim() || null,
      subhead: isAnnouncement ? subhead.trim() || null : null,
      bannerColor: isAnnouncement && !bannerImage ? bannerColor : null,
      bannerImageId: isAnnouncement ? (bannerImage?.id ?? null) : null,
      contentHtml: editor.isEmpty ? "" : editor.getHTML(),
      media: album.toInput(),
      attachmentIds: doneAttachments.map((a) => a.file!.id),
    };

    try {
      if (post) {
        await updatePost({ id: post.id, updatePostCommand: { ...body, version: post.version } }).unwrap();
        toast.success(t("posts.composer.saved"));
      } else {
        await createPost({ createPostCommand: { ...body, commentsDisabled: !commentsAllowed } }).unwrap();
        toast.success(t("posts.composer.published"));
      }
      onDone();
    } catch (error) {
      // Includes 409 (edited elsewhere): the composer stays open so the author keeps their text.
      setProblem(toApiProblem(error));
    }
  }

  function close() {
    if (isDirty) setDiscardOpen(true);
    else onDone();
  }

  const problemMessages = problem
    ? problem.code === ErrorCodes.validationFailed
      ? Object.values(problem.errors ?? {}).flat()
      : problem.code === ErrorCodes.conflict
        ? [`${problem.detail ?? t("posts.composer.conflict")} ${t("posts.composer.conflictHint")}`]
        : [problem.detail ?? t("common.genericError")]
    : [];

  return (
    // Its parts, for the feed's composer to bring in one after another as it opens (globals.css).
    <div data-composer-parts className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <UserAvatar fullName={user?.fullName} avatarUrl={profile?.avatarUrl} size="sm" className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{user?.fullName}</span>
        <Tooltip delay={400}>
          <Button isIconOnly size="sm" variant="ghost" aria-label={post ? t("posts.composer.cancelEdit") : t("posts.close")} onPress={close}>
            <Xmark className="size-4" />
          </Button>
          <Tooltip.Content>{post ? t("posts.composer.cancelEdit") : t("posts.close")}</Tooltip.Content>
        </Tooltip>
      </div>

      <Separator />

      {isAnnouncement ? (
        <BannerEditor
          subject={subject}
          subhead={subhead}
          color={bannerColor}
          image={bannerImage}
          onSubjectChange={(value) => {
            setSubject(value);
            setDirty(true);
          }}
          onSubheadChange={(value) => {
            setSubhead(value);
            setDirty(true);
          }}
          onColorChange={setBannerColor}
          onImagePick={(file) => void pickBannerImage(file)}
          onImageRemove={() => setBannerImage(null)}
        />
      ) : (
        <input
          aria-label={t("posts.title")}
          placeholder={t("posts.addTitle")}
          maxLength={200}
          value={subject}
          onChange={(event) => {
            setSubject(event.target.value);
            setDirty(true);
          }}
          className="w-full border-b border-separator bg-transparent pb-2 text-lg font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted"
        />
      )}

      {editor && (
        <Toolbar
          editor={editor}
          isAnnouncement={isAnnouncement}
          onAnnouncementChange={(value) => {
            setAnnouncement(value);
            setDirty(true);
          }}
        />
      )}

      {/* The table handles are laid over the text, positioned from this frame. */}
      <div ref={editorFrame} className="relative">
        <EditorContent editor={editor} className="max-h-[50svh] scrollbar overflow-y-auto" />
        {editor && <TableHandles editor={editor} container={editorFrame} />}
      </div>

      {isDropZoneOpen && (
        <MediaDropZone
          onFiles={(files) => {
            album.add(files);
            setDropZoneOpen(false);
          }}
        />
      )}

      <AlbumPreview album={album} onEdit={() => setAlbumOpen(true)} />

      {attachments.items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {attachments.items.map((a) => (
            <li key={a.key}>
              <FileUploadItem item={a} onRetry={() => attachments.retry(a.key)} onRemove={() => attachments.remove(a.key)} />
            </li>
          ))}
        </ul>
      )}

      {problemMessages.length > 0 && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{post ? t("posts.composer.saveError") : t("posts.composer.publishError")}</Alert.Title>
            <Alert.Description>{problemMessages.join(" ")}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <Separator />

      <div className="flex items-center gap-1">
        <EmojiButton onPick={(emoji) => editor?.chain().focus().insertContent(emoji).run()} />
        <Tooltip delay={400}>
          <Button isIconOnly size="sm" variant="ghost" aria-label={t("posts.attachFile")} onPress={() => fileInput.current?.click()}>
            <Paperclip className="size-4" />
          </Button>
          <Tooltip.Content>{t("posts.attachFile")}</Tooltip.Content>
        </Tooltip>
        <Tooltip delay={400}>
          <Button isIconOnly size="sm" variant="ghost" aria-label={t("posts.addMedia")} onPress={() => setDropZoneOpen((open) => !open)}>
            <Picture className="size-4" />
          </Button>
          <Tooltip.Content>{t("posts.addMedia")}</Tooltip.Content>
        </Tooltip>

        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ATTACHMENT_EXTENSIONS.join(",")}
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(event) => {
            addAttachments(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <input
          ref={mediaInput}
          type="file"
          multiple
          accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")}
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            album.add(files);
          }}
        />

        <span className="flex-1" />
        {/* Chosen when the post is made; an existing post has comments turned off or on from its ⋯ menu. */}
        {!post && (
          <Switch size="sm" isSelected={commentsAllowed} onChange={setCommentsAllowed}>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Label>{t("posts.comments.allow")}</Label>
            </Switch.Content>
          </Switch>
        )}
        <Button isDisabled={!canSubmit} isPending={isCreating || isUpdating} onPress={() => void submit()}>
          {post ? t("posts.save") : t("posts.publish")}
        </Button>
      </div>

      <AlbumEditor
        album={album}
        isOpen={isAlbumOpen}
        onOpenChange={setAlbumOpen}
        onAdd={() => mediaInput.current?.click()}
      />

      <AlertDialog.Backdrop isOpen={isDiscardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-sm">
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading>{post ? t("posts.composer.discardChanges") : t("posts.composer.discardDraft")}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>{t("posts.composer.discardDescription")}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                {t("posts.composer.keepWriting")}
              </Button>
              <Button variant="danger" onPress={onDone}>
                {t("posts.composer.discard")}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
