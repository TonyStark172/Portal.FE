"use client";

import { useContext, useEffect } from "react";
import { ComboBoxStateContext } from "react-aria-components/ComboBox";

/** Closes a combo box's suggestions when its query is cleared, and reopens them when results arrive while focused. */
export function CloseEmptySuggestions({ query, ready = false }: { query: string; ready?: boolean }) {
  const state = useContext(ComboBoxStateContext);
  useEffect(() => { if (!query) state?.close(); }, [query, state]);
  useEffect(() => {
    // Async results may arrive after scrolling the modal closed an empty popover.
    // Reopen only on a new result batch, and only while the input still has focus.
    if (query && ready && state?.isFocused) state.open(null, "manual");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, ready]);
  return null;
}
