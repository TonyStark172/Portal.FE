/** The user's colour scheme choice, remembered in a cookie. "system" follows the operating system. */
export type Theme = "light" | "dark" | "system";

export const THEME_COOKIE = "portal_theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The user's colour theme (colorThemes.css), remembered in a cookie too. "default" is HeroUI's own colours. */
export const COLOR_THEMES = ["default", "sky", "lavender", "mint", "netflix", "uber", "brutalism", "glass", "mouve"] as const;
export type ColorTheme = (typeof COLOR_THEMES)[number];

export const COLOR_THEME_COOKIE = "portal_color_theme";
const NAMED_COLOR_THEMES = COLOR_THEMES.filter((theme) => theme !== "default").join("|");

/** Event fired in this tab when the theme changes, so every switch shows the new choice. */
export const THEME_CHANGE_EVENT = "portal-theme-change";

/**
 * Runs in <head> before the first paint, so a dark page never flashes white.
 * It mirrors readTheme + applyTheme and readColorTheme + applyColorTheme below; keep them in sync.
 */
export const themeScript = `(function(){try{
var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)/);
var t=m?m[1]:"system";
var d=t==="dark"||(t==="system"&&window.matchMedia("${DARK_QUERY}").matches);
var e=document.documentElement;
e.classList.toggle("dark",d);e.dataset.theme=d?"dark":"light";e.style.colorScheme=d?"dark":"light";
var c=document.cookie.match(/(?:^|; )${COLOR_THEME_COOKIE}=(${NAMED_COLOR_THEMES})(?:;|$)/);
if(c)e.dataset.colorTheme=c[1];
}catch(_){}})();`;

export function readTheme(): Theme {
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark|system)`));
  return (match?.[1] as Theme | undefined) ?? "system";
}

/** Whether the theme shows dark colours now ("system" asks the operating system). */
export function isDarkTheme(theme: Theme) {
  return theme === "dark" || (theme === "system" && window.matchMedia(DARK_QUERY).matches);
}

/** Applies the theme to <html>: HeroUI switches its colours on the `dark` class / `data-theme`. */
export function applyTheme(theme: Theme) {
  const isDark = isDarkTheme(theme);
  const root = document.documentElement;

  root.classList.toggle("dark", isDark);
  root.dataset.theme = isDark ? "dark" : "light";
  root.style.colorScheme = isDark ? "dark" : "light";
}

export function saveTheme(theme: Theme) {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  applyTheme(theme);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function readColorTheme(): ColorTheme {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COLOR_THEME_COOKIE}=(${NAMED_COLOR_THEMES})(?:;|$)`));
  return (match?.[1] as ColorTheme | undefined) ?? "default";
}

/** Applies the colour theme to <html>; the default one needs no attribute. */
export function applyColorTheme(colorTheme: ColorTheme) {
  const root = document.documentElement;
  if (colorTheme === "default") delete root.dataset.colorTheme;
  else root.dataset.colorTheme = colorTheme;
}

export function saveColorTheme(colorTheme: ColorTheme) {
  document.cookie = `${COLOR_THEME_COOKIE}=${colorTheme}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  applyColorTheme(colorTheme);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** Calls `onChange` when the operating system switches between light and dark. */
export function watchSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
