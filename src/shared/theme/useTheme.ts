"use client";

import { useSyncExternalStore } from "react";
import { readColorTheme, readTheme, saveColorTheme, saveTheme, THEME_CHANGE_EVENT, type ColorTheme, type Theme } from "./theme";

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
}

/** The current theme choice and a setter that remembers it. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
  return [theme, saveTheme];
}

/** The current colour theme and a setter that remembers it. */
export function useColorTheme(): [ColorTheme, (colorTheme: ColorTheme) => void] {
  const colorTheme = useSyncExternalStore(subscribe, readColorTheme, () => "default" as ColorTheme);
  return [colorTheme, saveColorTheme];
}
