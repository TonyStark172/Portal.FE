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
export function imageError(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return `"${file.name}" không phải ảnh JPG, PNG, WebP hoặc GIF.`;
  if (file.size > MAX_IMAGE_MB * MB) return `Ảnh "${file.name}" vượt quá ${MAX_IMAGE_MB} MB.`;
  return null;
}

/** Why the image or video cannot go to the album, or null when it can. */
export function mediaError(file: File): string | null {
  const kind = mediaKindOf(file);
  if (kind === "Image") return imageError(file);
  if (kind === "Video")
    return file.size > MAX_VIDEO_MB * MB ? `Video "${file.name}" vượt quá ${MAX_VIDEO_MB} MB.` : null;
  return `"${file.name}" không phải ảnh (JPG, PNG, WebP, GIF) hoặc video (MP4, WebM, MOV).`;
}

/** Why the attachment cannot be used, or null when it can. */
export function attachmentError(file: File): string | null {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ATTACHMENT_EXTENSIONS.includes(extension))
    return `"${file.name}": chỉ đính kèm được PDF, Word, Excel, PowerPoint, TXT, CSV hoặc ZIP.`;
  if (file.size > MAX_ATTACHMENT_MB * MB) return `Tệp "${file.name}" vượt quá ${MAX_ATTACHMENT_MB} MB.`;
  return null;
}

/**
 * Images and videos carried by a paste or drop. Copying cells from Excel or text from Word also puts a picture of
 * the selection on the clipboard; when real text comes along, the text is what the user meant to paste.
 * ("Copy image" in a browser adds only an <img> as HTML, with no text, so it still pastes as an image.)
 */
export function mediaFilesOf(data: DataTransfer | null): File[] {
  if (!data || data.getData("text/plain").trim() !== "") return [];
  return Array.from(data.files).filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
}
