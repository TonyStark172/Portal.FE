"use client";

import { useSyncExternalStore } from "react";
import { readTheme, saveTheme, THEME_CHANGE_EVENT, type Theme } from "./theme";

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
}

/** The current theme choice and a setter that remembers it. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
  return [theme, saveTheme];
}
