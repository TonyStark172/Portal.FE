"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Where a tab puts its own controls: the right end of the row holding the tabs. */
export const DashboardToolbarSlot = createContext<HTMLElement | null>(null);

/**
 * Controls of the current tab (e.g. its period filter), shown at the right of the tabs. Outside the dashboard
 * layout (e.g. in tests) they stay where they are rendered.
 */
export function DashboardToolbarActions({ children }: { children: ReactNode }) {
  const slot = useContext(DashboardToolbarSlot);
  return slot ? createPortal(children, slot) : <div className="flex justify-end">{children}</div>;
}
