/**
 * Names Portal.BE accepts in post content (PostPalette), with Vietnamese labels for the toolbar.
 * The colours themselves live in globals.css (.post-content), one shade per theme.
 */
/** Text colours and highlights: the same nine, in the order of Tiptap's colour picker. */
export const textColors = [
  { name: "gray", label: "Xám" },
  { name: "brown", label: "Nâu" },
  { name: "orange", label: "Cam" },
  { name: "yellow", label: "Vàng" },
  { name: "green", label: "Xanh lá" },
  { name: "blue", label: "Xanh dương" },
  { name: "purple", label: "Tím" },
  { name: "pink", label: "Hồng" },
  { name: "red", label: "Đỏ" },
] as const;

export const highlightColors = [
  { name: "gray", label: "Xám" },
  { name: "brown", label: "Nâu" },
  { name: "orange", label: "Cam" },
  { name: "yellow", label: "Vàng" },
  { name: "green", label: "Xanh lá" },
  { name: "blue", label: "Xanh dương" },
  { name: "purple", label: "Tím" },
  { name: "pink", label: "Hồng" },
  { name: "red", label: "Đỏ" },
] as const;

/** `null` is the normal size (no attribute). */
export const textSizes = [
  { name: "small", label: "Nhỏ" },
  { name: null, label: "Thường" },
  { name: "large", label: "Lớn" },
  { name: "xlarge", label: "Rất lớn" },
] as const;

/** `null` is the app's font (no attribute); the CSS of each name is in globals.css. */
export const fonts = [
  { name: null, label: "Mặc định" },
  { name: "arial", label: "Arial" },
  { name: "times", label: "Times New Roman" },
  { name: "tahoma", label: "Tahoma" },
  { name: "verdana", label: "Verdana" },
  { name: "courier", label: "Courier New" },
] as const;

export const bannerColors = [
  { name: "blue", label: "Xanh dương" },
  { name: "green", label: "Xanh lá" },
  { name: "orange", label: "Cam" },
  { name: "red", label: "Đỏ" },
  { name: "purple", label: "Tím" },
  { name: "gray", label: "Xám" },
] as const;

export type BannerColor = (typeof bannerColors)[number]["name"];

export const DEFAULT_BANNER_COLOR: BannerColor = "blue";
