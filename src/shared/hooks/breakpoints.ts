"use client";

import { useSyncExternalStore } from "react";

/**
 * Screen sizes, the one source for layouts chosen in code (the calendar, the sidebar); globals.css repeats these
 * media queries (the `phone` variant and the calendar's phone styles).
 * - phone: below Tailwind's `md` (767px), or a short screen below `lg` — a phone turned sideways (320–440px tall);
 * - tablet: from `md` up to 1024px (a tablet turned sideways stays one);
 * - desktop: wider.
 */
export type ScreenSize = "phone" | "tablet" | "desktop";
export type Orientation = "portrait" | "landscape";
export const phoneQuery = "(max-width: 767px), (max-height: 500px) and (max-width: 1023px)";
export const desktopQuery = "(min-width: 1025px)";
const landscapeQuery = "(orientation: landscape)";

export const readBreakpoint = (): ScreenSize =>
  window.matchMedia(phoneQuery).matches ? "phone" : window.matchMedia(desktopQuery).matches ? "desktop" : "tablet";
export const readOrientation = (): Orientation => window.matchMedia(landscapeQuery).matches ? "landscape" : "portrait";

const subscribeTo = (...queries: string[]) => (notify: () => void) => {
  const media = queries.map(query => window.matchMedia(query));
  media.forEach(list => list.addEventListener("change", notify));
  return () => media.forEach(list => list.removeEventListener("change", notify));
};
const subscribeSize = subscribeTo(phoneQuery, desktopQuery);
const subscribeOrientation = subscribeTo(landscapeQuery);

/** The screen's size; "desktop" on the server and while hydrating. */
export const useBreakpoint = () => useSyncExternalStore(subscribeSize, readBreakpoint, () => "desktop" as const);
/** Whether the screen is upright or turned sideways; "landscape" on the server and while hydrating. */
export const useOrientation = () => useSyncExternalStore(subscribeOrientation, readOrientation, () => "landscape" as const);
