import type { PostCommentDto, PostDto } from "@/shared/api/generated/portalApi";

/** A post as the comments tests need it: the author is not the reader, and comments are on. */
export const makePost = (over: Partial<PostDto> = {}): PostDto =>
  ({
    id: 7,
    kind: "Normal",
    contentHtml: "<p>Bài viết</p>",
    author: { id: 1, fullName: "Nguyễn Văn An" },
    createdAt: "2026-10-01T08:00:00Z",
    media: [],
    attachments: [],
    mentions: [],
    mentionsEveryone: false,
    reactions: [],
    myReaction: null,
    isPinned: false,
    canPin: false,
    canEdit: false,
    canDelete: false,
    commentCount: 0,
    commentsDisabled: false,
    canToggleComments: false,
    version: 1,
    ...over,
  }) as PostDto;

/** A comment by Trần Thị Bình, a root with no replies. */
export const makeComment = (id: number, over: Partial<PostCommentDto> = {}): PostCommentDto => ({
  id,
  postId: 7,
  parentId: null,
  contentHtml: `<p>Bình luận ${id}</p>`,
  author: { id: 2, fullName: "Trần Thị Bình", avatarUrl: null, positionName: "Kế toán" },
  isPostAuthor: false,
  createdAt: "2026-10-02T08:00:00Z",
  editedAt: null,
  isDeleted: false,
  file: null,
  reactions: [],
  myReaction: null,
  replyCount: 0,
  replies: [],
  canEdit: false,
  canDelete: false,
  ...over,
});

/** The tombstone left by a deleted comment that still has replies. */
export const makeTombstone = (id: number, over: Partial<PostCommentDto> = {}): PostCommentDto =>
  makeComment(id, { isDeleted: true, contentHtml: "", author: null, ...over });
