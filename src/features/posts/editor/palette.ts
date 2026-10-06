/**
 * Names Portal.BE accepts in post content (PostPalette), with Vietnamese labels for the toolbar.
 * The colours themselves live in globals.css (.post-content), one shade per theme.
 */
export const textColors = [
  { name: "red", label: "Đỏ" },
  { name: "orange", label: "Cam" },
  { name: "yellow", label: "Vàng" },
  { name: "green", label: "Xanh lá" },
  { name: "blue", label: "Xanh dương" },
  { name: "purple", label: "Tím" },
  { name: "gray", label: "Xám" },
] as const;

export const highlightColors = [
  { name: "yellow", label: "Vàng" },
  { name: "green", label: "Xanh lá" },
  { name: "blue", label: "Xanh dương" },
  { name: "pink", label: "Hồng" },
  { name: "gray", label: "Xám" },
] as const;

/** `null` is the normal size (no attribute). */
export const textSizes = [
  { name: "small", label: "Nhỏ" },
  { name: null, label: "Thường" },
  { name: "large", label: "Lớn" },
  { name: "xlarge", label: "Rất lớn" },
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
