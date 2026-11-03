/**
 * Names Portal.BE accepts in post content (PostPalette), with the locale keys of their labels for the toolbar.
 * The colours themselves live in globals.css (.post-content), one shade per theme.
 */
/** Text colours and highlights: the same nine, in the order of Tiptap's colour picker. */
export const textColors = [
  { name: "gray", label: "posts.color.gray" },
  { name: "brown", label: "posts.color.brown" },
  { name: "orange", label: "posts.color.orange" },
  { name: "yellow", label: "posts.color.yellow" },
  { name: "green", label: "posts.color.green" },
  { name: "blue", label: "posts.color.blue" },
  { name: "purple", label: "posts.color.purple" },
  { name: "pink", label: "posts.color.pink" },
  { name: "red", label: "posts.color.red" },
] as const;

export const highlightColors = [
  { name: "gray", label: "posts.color.gray" },
  { name: "brown", label: "posts.color.brown" },
  { name: "orange", label: "posts.color.orange" },
  { name: "yellow", label: "posts.color.yellow" },
  { name: "green", label: "posts.color.green" },
  { name: "blue", label: "posts.color.blue" },
  { name: "purple", label: "posts.color.purple" },
  { name: "pink", label: "posts.color.pink" },
  { name: "red", label: "posts.color.red" },
] as const;

/** `null` is the normal size (no attribute). */
export const textSizes = [
  { name: "small" },
  { name: null },
  { name: "large" },
  { name: "xlarge" },
] as const;

/** `null` is the app's font (no attribute); the CSS of each name is in globals.css. */
export const fonts = [
  { name: null, label: "posts.fontDefault" },
  { name: "arial", label: "Arial" },
  { name: "times", label: "Times New Roman" },
  { name: "tahoma", label: "Tahoma" },
  { name: "verdana", label: "Verdana" },
  { name: "courier", label: "Courier New" },
] as const;

export const bannerColors = [
  { name: "blue", label: "posts.color.blue" },
  { name: "green", label: "posts.color.green" },
  { name: "orange", label: "posts.color.orange" },
  { name: "red", label: "posts.color.red" },
  { name: "purple", label: "posts.color.purple" },
  { name: "gray", label: "posts.color.gray" },
] as const;

export type BannerColor = (typeof bannerColors)[number]["name"];

export const DEFAULT_BANNER_COLOR: BannerColor = "blue";
