/** The user's colour scheme choice, remembered in a cookie. "system" follows the operating system. */
export type Theme = "light" | "dark" | "system";

export const THEME_COOKIE = "portal_theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Event fired in this tab when the theme changes, so every switch shows the new choice. */
export const THEME_CHANGE_EVENT = "portal-theme-change";

/**
 * Runs in <head> before the first paint, so a dark page never flashes white.
 * It mirrors readTheme + applyTheme below; keep the two in sync.
 */
export const themeScript = `(function(){try{
var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)/);
var t=m?m[1]:"system";
var d=t==="dark"||(t==="system"&&window.matchMedia("${DARK_QUERY}").matches);
var e=document.documentElement;
e.classList.toggle("dark",d);e.dataset.theme=d?"dark":"light";e.style.colorScheme=d?"dark":"light";
}catch(_){}})();`;

export function readTheme(): Theme {
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark|system)`));
  return (match?.[1] as Theme | undefined) ?? "system";
}

/** Applies the theme to <html>: HeroUI switches its colours on the `dark` class / `data-theme`. */
export function applyTheme(theme: Theme) {
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia(DARK_QUERY).matches);
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

/** Calls `onChange` when the operating system switches between light and dark. */
export function watchSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
