import { COLOR_THEMES, type ColorTheme } from "@/shared/theme/theme";

export type Rgba = [number, number, number, number];

const UNPARSED = "#123456";

/**
 * A 1×1 canvas resolves any CSS colour (oklch, lab, color-mix…) to sRGB bytes, with its alpha. A string the canvas
 * does not understand leaves the previous fill in place, which would read back as a colour of its own, so it fails.
 */
export function toRgba(color: string): Rgba {
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  context.fillStyle = UNPARSED;
  context.fillStyle = color;
  if (context.fillStyle === UNPARSED) throw new Error(`The canvas does not understand the colour "${color}".`);
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

/** `top` laid over `bottom`. */
export const over = ([r, g, b, a]: Rgba, [br, bg, bb]: Rgba): Rgba => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];

function luminance([r, g, b]: Rgba) {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** The WCAG contrast ratio of two opaque colours. */
export const contrast = (a: Rgba, b: Rgba) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

/** WCAG AA for small text. */
export const MIN_TEXT_CONTRAST = 4.5;
/** WCAG 1.4.11: a shape that carries meaning. */
export const MIN_SHAPE_CONTRAST = 3;

/** The colour of an element as it shows on `behind`. */
export const colorOn = (element: Element, behind: Rgba) => over(toRgba(getComputedStyle(element).color), behind);
export const backgroundOn = (element: Element, behind: Rgba) => over(toRgba(getComputedStyle(element).backgroundColor), behind);

/** Runs `check` with the page in light and in dark, in the default and each named colour theme; `label` says which. */
export function inEveryTheme(check: (label: string) => void) {
  const root = document.documentElement;
  for (const dark of [false, true]) {
    for (const theme of COLOR_THEMES) {
      root.classList.toggle("dark", dark);
      root.dataset.theme = dark ? "dark" : "light";
      setColorTheme(theme);
      check(`${dark ? "dark" : "light"}/${theme}`);
    }
  }
}

function setColorTheme(theme: ColorTheme) {
  if (theme === "default") delete document.documentElement.dataset.colorTheme;
  else document.documentElement.dataset.colorTheme = theme;
}

export function resetTheme() {
  const root = document.documentElement;
  root.classList.remove("dark");
  delete root.dataset.theme;
  delete root.dataset.colorTheme;
}
