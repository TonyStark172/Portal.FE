"use client";

/*
 * Sidebar built from free HeroUI v3 parts. The structure (provider, icon rail, mobile drawer, cookie,
 * keyboard shortcut) is adapted from shadcn/ui's Sidebar via github.com/Dan6erbond/heroui-sidebar,
 * both MIT licensed.
 */

import { createContext, use, useRef, type ComponentProps, type ReactNode } from "react";
import NextLink from "next/link";
import { Button, Drawer, Tooltip } from "@heroui/react";
import { mergeProps, useFocusable } from "react-aria";
import { LayoutSideContentLeft } from "@gravity-ui/icons";
import { useSidebar } from "./SidebarProvider";

/** How the current copy of the sidebar is shown: the desktop rail can be collapsed, the drawer cannot. */
type SidebarSurface = { isCollapsed: boolean; isDrawer: boolean };

const SurfaceContext = createContext<SidebarSurface>({ isCollapsed: false, isDrawer: false });

/** Whether the sidebar part being rendered is collapsed to its icons, or inside the mobile drawer. */
export function useSidebarSurface(): SidebarSurface {
  return use(SurfaceContext);
}

/**
 * The navigation panel: a rail on desktop (`md` and up) and a drawer from the left on mobile.
 * Children use `group-data-[state=collapsed]/sidebar:` classes to adapt to the collapsed rail.
 */
export function Sidebar({ label, children }: { label: string; children: ReactNode }) {
  const { isCollapsed, isMobileOpen, setMobileOpen } = useSidebar();
  const state = isCollapsed ? "collapsed" : "expanded";

  return (
    <>
      <SurfaceContext value={{ isCollapsed, isDrawer: false }}>
        <aside
          aria-label={label}
          data-state={state}
          className="group/sidebar sticky top-0 hidden h-svh w-64 shrink-0 flex-col overflow-hidden border-r border-separator bg-surface transition-[width] duration-200 ease-linear data-[state=collapsed]:w-14 md:flex"
        >
          {children}
        </aside>
      </SurfaceContext>

      <Drawer.Backdrop isOpen={isMobileOpen} onOpenChange={setMobileOpen}>
        <Drawer.Content placement="left" className="w-72 max-w-[85vw]">
          <Drawer.Dialog aria-label={label} className="h-full p-0">
            <SurfaceContext value={{ isCollapsed: false, isDrawer: true }}>
              <div data-state="expanded" className="group/sidebar flex h-full flex-col bg-surface">
                {children}
              </div>
            </SurfaceContext>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </>
  );
}

export function SidebarHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 px-3 group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0">
      {children}
    </div>
  );
}

export function SidebarContent({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-2 py-2">{children}</div>;
}

export function SidebarFooter({ children }: { children: ReactNode }) {
  return <div className="shrink-0 border-t border-separator p-2">{children}</div>;
}

export function SidebarMenu({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-1">{children}</ul>;
}

type SidebarMenuLinkProps = {
  href: ComponentProps<typeof NextLink>["href"];
  icon: ReactNode;
  isActive?: boolean;
  children: string;
};

/** A menu entry: a real link (opens in a new tab, prefetched by Next), with a tooltip when collapsed. */
export function SidebarMenuLink({ href, icon, isActive = false, children }: SidebarMenuLinkProps) {
  const { setMobileOpen } = useSidebar();
  const { isCollapsed, isDrawer } = useSidebarSurface();

  return (
    <li>
      <Tooltip delay={0} isDisabled={!isCollapsed}>
        <TooltipLink
          href={href}
          aria-current={isActive ? "page" : undefined}
          onClick={() => isDrawer && setMobileOpen(false)}
          className="flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm text-foreground outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus aria-[current=page]:bg-default aria-[current=page]:font-medium group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0 [&>svg]:size-4 [&>svg]:shrink-0"
        >
          {icon}
          <span className="truncate group-data-[state=collapsed]/sidebar:sr-only">{children}</span>
        </TooltipLink>
        <Tooltip.Content placement="right">{children}</Tooltip.Content>
      </Tooltip>
    </li>
  );
}

/**
 * A Next link that can trigger a tooltip. Uses `useFocusable` like HeroUI's own tooltip trigger rather than
 * React Aria's `<Focusable>`, whose dev check warns falsely for links in the hidden desktop rail on mobile.
 */
function TooltipLink(props: ComponentProps<typeof NextLink>) {
  const ref = useRef<HTMLAnchorElement>(null);
  const { focusableProps } = useFocusable({}, ref);

  return <NextLink ref={ref} {...mergeProps(focusableProps, props)} />;
}

/** Collapses/expands the sidebar on desktop and opens the drawer on mobile (also Ctrl/⌘+B). */
export function SidebarTrigger() {
  const { toggle } = useSidebar();

  return (
    <Button isIconOnly size="sm" variant="ghost" aria-label="Ẩn/hiện menu (Ctrl+B)" onPress={toggle}>
      <LayoutSideContentLeft className="size-4" />
    </Button>
  );
}

/** The page next to the sidebar. */
export function SidebarMain({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-1 flex-col">{children}</div>;
}
