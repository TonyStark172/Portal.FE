/** Same limits as Portal.BE (PostFileRules), checked first so a wrong file fails without an upload. */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const MAX_IMAGE_MB = 5;
export const MAX_VIDEO_MB = 100;
/** Images and videos of the album together. */
export const MAX_MEDIA = 20;
export const MAX_CAPTION = 500;
export const ATTACHMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".zip"];
export const MAX_ATTACHMENT_MB = 20;
export const MAX_ATTACHMENTS = 10;

const MB = 1024 * 1024;

export type MediaKind = "Image" | "Video";

/** Whether the file goes to the album as an image or a video; null for anything else. */
export function mediaKindOf(file: File): MediaKind | null {
  if (IMAGE_TYPES.includes(file.type)) return "Image";
  if (VIDEO_TYPES.includes(file.type)) return "Video";
  return null;
}

/** Why the image cannot be used, or null when it can. */
export function imageError(file: File, t: (key: string) => string): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return t("posts.file.notImage").replace("{name}", file.name);
  if (file.size > MAX_IMAGE_MB * MB) return t("posts.file.imageTooBig").replace("{name}", file.name).replace("{max}", String(MAX_IMAGE_MB));
  return null;
}

/** Why the image or video cannot go to the album, or null when it can. */
export function mediaError(file: File, t: (key: string) => string): string | null {
  const kind = mediaKindOf(file);
  if (kind === "Image") return imageError(file, t);
  if (kind === "Video")
    return file.size > MAX_VIDEO_MB * MB ? t("posts.file.videoTooBig").replace("{name}", file.name).replace("{max}", String(MAX_VIDEO_MB)) : null;
  return t("posts.file.notMedia").replace("{name}", file.name);
}

/** Why the attachment cannot be used, or null when it can. */
export function attachmentError(file: File, t: (key: string) => string): string | null {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ATTACHMENT_EXTENSIONS.includes(extension))
    return t("posts.file.notAttachment").replace("{name}", file.name);
  if (file.size > MAX_ATTACHMENT_MB * MB) return t("posts.file.attachmentTooBig").replace("{name}", file.name).replace("{max}", String(MAX_ATTACHMENT_MB));
  return null;
}

/**
 * Images and videos carried by a paste or drop. Copying cells from Excel or text from Word also puts a picture of
 * the selection on the clipboard; when real text comes along, the text is what the user meant to paste.
 * ("Copy image" in a browser adds only an <img> as HTML, with no text, so it still pastes as an image.)
 */
export function mediaFilesOf(data: DataTransfer | null): File[] {
  if (!data || data.getData("text/plain").trim() !== "") return [];
  return Array.from(data.files).filter(isMedia);
}

/** The other files carried by a paste or drop, to attach; as above, real text comes first. */
export function attachmentFilesOf(data: DataTransfer | null): File[] {
  if (!data || data.getData("text/plain").trim() !== "") return [];
  return Array.from(data.files).filter((file) => !isMedia(file));
}

const isMedia = (file: File) => file.type.startsWith("image/") || file.type.startsWith("video/");
