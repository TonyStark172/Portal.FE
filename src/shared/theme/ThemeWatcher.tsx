"use client";

import { useEffect } from "react";
import { applyTheme, readTheme, watchSystemTheme } from "./theme";

/** While the choice is "system", follows the operating system when it switches between light and dark. */
export function ThemeWatcher() {
  useEffect(
    () =>
      watchSystemTheme(() => {
        if (readTheme() === "system") applyTheme("system");
      }),
    [],
  );

  return null;
}
