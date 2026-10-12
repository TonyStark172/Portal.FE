"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { readBreakpoint, readOrientation, useBreakpoint, useOrientation } from "@/shared/hooks/breakpoints";
import { readPhone, usePhone } from "@/shared/hooks/usePhone";
import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE } from "./cookie";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const TOGGLE_SHORTCUT = "b";

type SidebarState = {
  /** On a phone, upright or sideways (breakpoints.ts): the sidebar is the drawer. False on the server and while hydrating. */
  isMobile: boolean;
  /** Off a phone: the sidebar is narrowed to its icons. An upright tablet starts so, whatever the desktop choice. */
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
 * toggled with Ctrl/⌘+B) and a drawer on mobile. An upright tablet is too narrow for the open rail: there it starts as
 * icons and opens for the moment, leaving the remembered choice alone.
 */
export function SidebarProvider({ defaultCollapsed = false, children }: { defaultCollapsed?: boolean; children: ReactNode }) {
  const [isCollapsed, setCollapsed] = useState(defaultCollapsed);
  const [isMobileOpen, setMobileOpen] = useState(false);
  const [isTabletOpen, setTabletOpen] = useState(false);
  const isMobile = usePhone();
  const isUprightTablet = useUprightTablet();

  const toggle = useCallback(() => {
    if (readPhone()) setMobileOpen((open) => !open);
    else if (readUprightTablet()) setTabletOpen((open) => !open);
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
    () => ({ isMobile, isCollapsed: isUprightTablet ? !isTabletOpen : isCollapsed, isMobileOpen, setMobileOpen, toggle }),
    [isMobile, isUprightTablet, isTabletOpen, isCollapsed, isMobileOpen, toggle],
  );

  return (
    <SidebarContext value={value}>
      <div className="flex min-h-svh w-full">{children}</div>
    </SidebarContext>
  );
}

/** A tablet held upright (768px wide or so), where the open rail would take a third of the page. */
const readUprightTablet = () => readBreakpoint() === "tablet" && readOrientation() === "portrait";
function useUprightTablet() {
  const size = useBreakpoint();
  const orientation = useOrientation();
  return size === "tablet" && orientation === "portrait";
}
