import { flushSync } from "react-dom";
import { isDarkTheme, saveTheme, type Theme } from "./theme";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Saves the theme and, where it changes the colours on screen, reveals the new look in a circle growing from `origin`
 * (the chosen button: its centre, and its size as the circle's first one, so the change shows under the pointer from
 * the first frame) over the old one, with the View Transitions API: the browser animates two pictures of
 * the page, not the page itself. The circle's keyframes are in globals.css (`theme-reveal`), only while `<html>` has
 * the `theme-reveal` class, so other view transitions keep the browser's own. Without the API, or asked for less
 * motion, the theme changes at once.
 */
export function revealTheme(theme: Theme, origin: { x: number; y: number; radius: number }) {
  const root = document.documentElement;
  const changesColours = isDarkTheme(theme) !== (root.dataset.theme === "dark");

  if (!changesColours || typeof document.startViewTransition !== "function" || window.matchMedia(REDUCED_MOTION).matches) {
    saveTheme(theme);
    return;
  }

  // Far enough to cover the screen's farthest corner from the origin.
  const radius = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y));
  root.style.setProperty("--theme-reveal-x", `${origin.x}px`);
  root.style.setProperty("--theme-reveal-y", `${origin.y}px`);
  root.style.setProperty("--theme-reveal-r", `${radius}px`);
  root.style.setProperty("--theme-reveal-from", `${origin.radius}px`);
  root.classList.add("theme-reveal");

  // The new picture is taken when the callback returns: React must have drawn the switch's new choice by then.
  const transition = document.startViewTransition(() => flushSync(() => saveTheme(theme)));
  // The browser may give the animation up (the window resized, another change on top): the theme is saved all the
  // same, there is just nothing to animate, which is no error.
  transition.ready.catch(() => {});
  const done = () => root.classList.remove("theme-reveal");
  void transition.finished.then(done, done);
}
