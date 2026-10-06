"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Picture, Xmark } from "@gravity-ui/icons";
import { Alert, AlertDialog, Button, Separator, Spinner, Tooltip, toast } from "@heroui/react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { useAppDispatch } from "@/core/hooks";
import { useCurrentUser } from "@/features/auth";
import { Permissions } from "@/shared/auth/permissions";
import { matchesVietnamese } from "@/shared/lib/vietnameseSearch";
import {
  portalApi,
  useCreatePostMutation,
  useGetMyProfileQuery,
  useUpdatePostMutation,
  type CreatePostCommand,
  type PostDto,
  type PostFileDto,
} from "@/shared/api/generated/portalApi";
import { ErrorCodes, toApiProblem, type ApiProblem } from "@/shared/api/problem";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { useUploadPostFileMutation } from "../../api";
import {
  EVERYONE,
  EVERYONE_LABEL,
  Highlight,
  PostMention,
  TextColor,
  TextSize,
} from "../../editor/extensions";
import { createMentionSuggestion } from "../../editor/mentionSuggestion";
import { DEFAULT_BANNER_COLOR, type BannerColor } from "../../editor/palette";
import { addPreview, revokePreviews } from "../../editor/previews";
import {
  ATTACHMENT_EXTENSIONS,
  IMAGE_TYPES,
  MAX_ATTACHMENTS,
  VIDEO_TYPES,
  attachmentError,
  imageError,
  mediaFilesOf,
} from "../../lib/fileRules";
import { useAlbum } from "../../hooks/useAlbum";
import { FileCard } from "../AttachmentList";
import { AlbumEditor } from "./AlbumEditor";
import { AlbumPreview } from "./AlbumPreview";
import { BannerEditor, type BannerImage } from "./BannerEditor";
import { EmojiButton } from "./EmojiButton";
import { Toolbar } from "./Toolbar";

type Attachment = {
  key: string;
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  file?: PostFileDto;
  source?: File;
};

type PostComposerProps = {
  /** The post to edit; a new post when omitted. */
  post?: PostDto;
  /** Called after posting, or when the author closes the composer. */
  onDone: () => void;
};

/** The composer of a post, like the "New post" box of a Teams channel. */
export function PostComposer({ post, onDone }: PostComposerProps) {
  const dispatch = useAppDispatch();
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
  const [attachments, setAttachments] = useState<Attachment[]>(
    () => post?.attachments.map((file) => ({ key: file.id, name: file.fileName, size: file.size, status: "done", file })) ?? [],
  );
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [isDirty, setDirty] = useState(false);
  const [isDiscardOpen, setDiscardOpen] = useState(false);
  const [isAlbumOpen, setAlbumOpen] = useState(false);
  const album = useAlbum(post?.media, () => setDirty(true));

  const mediaInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewIds = useRef(new Set<string>());
  // The editor is configured once; pasted or dropped files reach the current album through this.
  const addMediaRef = useRef<(files: File[]) => void>(() => {});

  // Built once: the suggestion keeps asking the store for colleagues as the user types after "@".
  const mentionSuggestion = useMemo(
    () =>
      createMentionSuggestion(async (query) => {
        const page = await dispatch(
          portalApi.endpoints.getProfiles.initiate({ search: query || undefined, pageSize: 8 }, { subscribe: false }),
        ).unwrap();
        const colleagues = page.items.map((p) => ({
          id: String(p.userId),
          label: p.fullName,
          avatarUrl: p.avatarUrl,
          positionName: p.assignments.find((a) => a.isPrimary)?.positionName,
        }));
        const everyoneMatches = ["Mọi người", "everyone", "all", "tất cả"].some((name) => matchesVietnamese(name, query));
        return canMentionEveryone && everyoneMatches
          ? [{ id: EVERYONE, label: EVERYONE_LABEL, avatarUrl: null, positionName: "Nhắc toàn công ty" }, ...colleagues]
          : colleagues;
      }),
    [dispatch, canMentionEveryone],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Placeholder.configure({ placeholder: "Nhập nội dung… gõ @ để nhắc đến đồng nghiệp" }),
      TextColor,
      TextSize,
      Highlight,
      PostMention.configure({ suggestion: mentionSuggestion }),
    ],
    content: post?.contentHtml ?? "",
    editorProps: {
      attributes: { class: "post-content min-h-28 px-1 py-2 outline-none", "aria-label": "Nội dung bài viết" },
      // Images and videos pasted or dropped into the text go to the album.
      handlePaste: (_view, event) => {
        const files = mediaFilesOf(event.clipboardData);
        if (files.length === 0) return false;
        addMediaRef.current(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = mediaFilesOf(event.dataTransfer);
        if (files.length === 0) return false;
        event.preventDefault();
        addMediaRef.current(files);
        return true;
      },
    },
    onUpdate: () => setDirty(true),
  });

  const hasText = useEditorState({ editor, selector: ({ editor: e }) => (e?.getText().trim().length ?? 0) > 0 }) ?? false;

  useEffect(() => {
    addMediaRef.current = album.add;
  });

  // Local previews are released when the composer closes.
  useEffect(() => {
    const ids = previewIds.current;
    return () => revokePreviews(ids);
  }, []);

  async function uploadAttachment(key: string, source: File) {
    setAttachments((items) => items.map((a) => (a.key === key ? { ...a, status: "uploading" } : a)));
    try {
      const file = await upload({ file: source, kind: "Attachment" }).unwrap();
      setAttachments((items) => items.map((a) => (a.key === key ? { ...a, status: "done", file } : a)));
    } catch (error) {
      setAttachments((items) => items.map((a) => (a.key === key ? { ...a, status: "error" } : a)));
      toast.danger(toApiProblem(error).detail ?? `Không tải được tệp "${source.name}".`);
    }
  }

  function addAttachments(files: File[]) {
    const room = MAX_ATTACHMENTS - attachments.length;
    if (files.length > room) toast.danger(`Tối đa ${MAX_ATTACHMENTS} tệp đính kèm mỗi bài.`);

    const accepted = files.slice(0, Math.max(room, 0)).filter((file) => {
      const error = attachmentError(file);
      if (error) toast.danger(error);
      return !error;
    });
    if (accepted.length === 0) return;

    const added = accepted.map((source) => ({
      key: crypto.randomUUID(),
      name: source.name,
      size: source.size,
      status: "uploading" as const,
      source,
    }));
    setAttachments((items) => [...items, ...added]);
    setDirty(true);
    added.forEach((a) => void uploadAttachment(a.key, a.source));
  }

  async function pickBannerImage(file: File) {
    const error = imageError(file);
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
      toast.danger(toApiProblem(error).detail ?? "Không tải được ảnh nền.");
    }
  }

  const isUploading =
    album.isUploading || attachments.some((a) => a.status === "uploading") || Boolean(bannerImage?.uploading);
  const doneAttachments = attachments.filter((a) => a.status === "done" && a.file);
  // A failed file is still listed, so posting without it would surprise the author: retry or remove it first.
  const hasFailedFile = album.hasFailed || attachments.some((a) => a.status === "error");
  const hasSubject = subject.trim().length > 0;
  const hasContent = hasText || album.hasMedia || doneAttachments.length > 0 || (isAnnouncement && hasSubject);
  const canSubmit =
    !isUploading && !hasFailedFile && hasContent && (!isAnnouncement || hasSubject) && !isCreating && !isUpdating;

  async function submit() {
    if (!editor || !canSubmit) return;
    setProblem(null);

    const body: CreatePostCommand = {
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
        toast.success("Đã lưu bài viết");
      } else {
        await createPost({ createPostCommand: body }).unwrap();
        toast.success("Đã đăng bài");
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
        ? [`${problem.detail ?? "Bài viết vừa được sửa ở nơi khác."} Hãy sao chép nội dung của bạn trước khi đóng.`]
        : [problem.detail ?? "Đã có lỗi xảy ra."]
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <UserAvatar fullName={user?.fullName} avatarUrl={profile?.avatarUrl} size="sm" className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{user?.fullName}</span>
        <Tooltip delay={400}>
          <Button isIconOnly size="sm" variant="ghost" aria-label={post ? "Huỷ sửa" : "Đóng"} onPress={close}>
            <Xmark className="size-4" />
          </Button>
          <Tooltip.Content>{post ? "Huỷ sửa" : "Đóng"}</Tooltip.Content>
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
          aria-label="Tiêu đề"
          placeholder="Thêm tiêu đề"
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

      <EditorContent editor={editor} className="max-h-[50svh] overflow-y-auto" />

      <AlbumPreview album={album} onEdit={() => setAlbumOpen(true)} />

      {attachments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {attachments.map((a) => (
            <li key={a.key}>
              <FileCard
                fileName={a.name}
                size={a.size}
                end={
                  <div className="flex items-center gap-1">
                    {a.status === "uploading" && <Spinner size="sm" aria-label="Đang tải tệp lên" />}
                    {a.status === "error" && a.source && (
                      <Button size="sm" variant="ghost" onPress={() => void uploadAttachment(a.key, a.source!)}>
                        Thử lại
                      </Button>
                    )}
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      aria-label={`Bỏ ${a.name}`}
                      onPress={() => setAttachments((items) => items.filter((item) => item.key !== a.key))}
                    >
                      <Xmark className="size-4" />
                    </Button>
                  </div>
                }
              />
            </li>
          ))}
        </ul>
      )}

      {problemMessages.length > 0 && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{post ? "Không lưu được bài viết" : "Không đăng được bài"}</Alert.Title>
            <Alert.Description>{problemMessages.join(" ")}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <Separator />

      <div className="flex items-center gap-1">
        <EmojiButton onPick={(emoji) => editor?.chain().focus().insertContent(emoji).run()} />
        <Tooltip delay={400}>
          <Button isIconOnly size="sm" variant="ghost" aria-label="Đính kèm tệp" onPress={() => fileInput.current?.click()}>
            <Paperclip className="size-4" />
          </Button>
          <Tooltip.Content>Đính kèm tệp</Tooltip.Content>
        </Tooltip>
        <Tooltip delay={400}>
          <Button isIconOnly size="sm" variant="ghost" aria-label="Thêm ảnh/video" onPress={() => mediaInput.current?.click()}>
            <Picture className="size-4" />
          </Button>
          <Tooltip.Content>Thêm ảnh/video</Tooltip.Content>
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
        <Button isDisabled={!canSubmit} isPending={isCreating || isUpdating} onPress={() => void submit()}>
          {post ? "Lưu" : "Đăng"}
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
              <AlertDialog.Heading>{post ? "Bỏ các thay đổi?" : "Bỏ bài đang soạn?"}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>Nội dung bạn vừa nhập sẽ không được lưu.</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Tiếp tục soạn
              </Button>
              <Button variant="danger" onPress={onDone}>
                Bỏ
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
