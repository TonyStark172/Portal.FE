"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE } from "./cookie";

/** Same breakpoint as Tailwind's `md`: below it the sidebar is a drawer. */
const MOBILE_QUERY = "(max-width: 767px)";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const TOGGLE_SHORTCUT = "b";

type SidebarState = {
  /** Desktop only: the sidebar is narrowed to its icons. */
  isCollapsed: boolean;
  /** Mobile only: the drawer is open. */
  isMobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  /** Collapses/expands on desktop, opens/closes the drawer on mobile. */
  toggle: () => void;
};

const SidebarContext = createContext<SidebarState | null>(null);

export function useSidebar(): SidebarState {
  const context = use(SidebarContext);
  if (!context) throw new Error("useSidebar must be used inside <SidebarProvider>.");
  return context;
}

/**
 * Holds the sidebar state for the page: a collapsible rail on desktop (remembered in a cookie,
 * toggled with Ctrl/⌘+B) and a drawer on mobile.
 */
export function SidebarProvider({ defaultCollapsed = false, children }: { defaultCollapsed?: boolean; children: ReactNode }) {
  const [isCollapsed, setCollapsed] = useState(defaultCollapsed);
  const [isMobileOpen, setMobileOpen] = useState(false);

  const toggle = useCallback(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) setMobileOpen((open) => !open);
    else setCollapsed((collapsed) => !collapsed);
  }, []);

  useEffect(() => {
    const value = isCollapsed ? SIDEBAR_COLLAPSED : "expanded";
    document.cookie = `${SIDEBAR_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  }, [isCollapsed]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === TOGGLE_SHORTCUT && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        toggle();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const value = useMemo(
    () => ({ isCollapsed, isMobileOpen, setMobileOpen, toggle }),
    [isCollapsed, isMobileOpen, toggle],
  );

  return (
    <SidebarContext value={value}>
      <div className="flex min-h-svh w-full">{children}</div>
    </SidebarContext>
  );
}
