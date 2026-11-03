import { expect, test } from "vitest";
import { translate } from "@/shared/i18n/locale";
import { attachmentError, imageError, mediaError } from "./fileRules";

const file = (name: string, type: string, mb = 0) => new File([new ArrayBuffer(mb * 1024 * 1024)], name, { type });
const vi = (key: string) => translate(key, "vi-VN");
const en = (key: string) => translate(key, "en-US");

test("says why an image or video cannot be used, in the reader's language", () => {
  const big = file("big.png", "image/png", 6);
  expect(imageError(big, vi)).toBe('Ảnh "big.png" vượt quá 5 MB.');
  expect(imageError(big, en)).toBe('Image "big.png" is larger than 5 MB.');
  expect(imageError(file("a.pdf", "application/pdf"), en)).toBe('"a.pdf" is not a JPG, PNG, WebP or GIF image.');

  const video = file("big.mp4", "video/mp4", 101);
  expect(mediaError(video, vi)).toBe('Video "big.mp4" vượt quá 100 MB.');
  expect(mediaError(video, en)).toBe('Video "big.mp4" is larger than 100 MB.');
  expect(mediaError(file("a.pdf", "application/pdf"), en)).toBe('"a.pdf" is not an image (JPG, PNG, WebP, GIF) or a video (MP4, WebM, MOV).');
});

test("says why an attachment cannot be used, in the reader's language", () => {
  const exe = file("a.exe", "application/octet-stream");
  expect(attachmentError(exe, vi)).toBe('"a.exe": chỉ đính kèm được PDF, Word, Excel, PowerPoint, TXT, CSV hoặc ZIP.');
  expect(attachmentError(exe, en)).toBe('"a.exe": only PDF, Word, Excel, PowerPoint, TXT, CSV or ZIP files can be attached.');

  const big = file("big.pdf", "application/pdf", 21);
  expect(attachmentError(big, vi)).toBe('Tệp "big.pdf" vượt quá 20 MB.');
  expect(attachmentError(big, en)).toBe('File "big.pdf" is larger than 20 MB.');
  expect(attachmentError(file("a.pdf", "application/pdf"), en)).toBeNull();
});

test("has nothing to say of a file it takes", () => {
  expect(imageError(file("a.png", "image/png"), en)).toBeNull();
  expect(mediaError(file("a.mp4", "video/mp4"), en)).toBeNull();
});
