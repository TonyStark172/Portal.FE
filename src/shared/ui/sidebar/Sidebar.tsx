"use client";

/*
 * Sidebar built from free HeroUI v3 parts. The structure (provider, icon rail, mobile drawer, cookie,
 * keyboard shortcut) is adapted from shadcn/ui's Sidebar via github.com/Dan6erbond/heroui-sidebar,
 * both MIT licensed.
 */

import { createContext, use, useRef, type ComponentProps, type ReactNode } from "react";
import NextLink from "next/link";
import { Button, Drawer, Kbd, Tooltip } from "@heroui/react";
import { mergeProps, useFocusable } from "react-aria";
import { LayoutSideContentLeft } from "@gravity-ui/icons";
import { useSidebar } from "./SidebarProvider";
import { useLocale } from "@/shared/i18n";

/** How the current copy of the sidebar is shown: the desktop rail can be collapsed, the drawer cannot. */
type SidebarSurface = { isCollapsed: boolean; isDrawer: boolean };

const SurfaceContext = createContext<SidebarSurface>({ isCollapsed: false, isDrawer: false });

/** Whether the sidebar part being rendered is collapsed to its icons, or inside the mobile drawer. */
export function useSidebarSurface(): SidebarSurface {
  return use(SurfaceContext);
}

/**
 * The navigation panel: a rail on tablets and desktops, and a drawer from the left on a phone (upright or sideways:
 * `phoneQuery`, the `phone:` variant).
 * Children use `group-data-[state=collapsed]/sidebar:` classes to adapt to the collapsed rail.
 */
export function Sidebar({ label, children }: { label: string; children: ReactNode }) {
  const { isMobile, isCollapsed, isMobileOpen, setMobileOpen } = useSidebar();
  const { t } = useLocale();
  const state = isCollapsed ? "collapsed" : "expanded";

  return (
    <>
      {/*
        Not an <aside>: this is the main navigation (the landmark is the <nav> in SidebarMenu), not side content.
        On mobile the rail is not rendered at all (until hydration, CSS hides it): a hidden copy of its menus
        would open with no trigger box to anchor to, at the top of the screen.
      */}
      {!isMobile && (
        <SurfaceContext value={{ isCollapsed, isDrawer: false }}>
          <div
            data-state={state}
            className="group/sidebar sticky top-0 isolate flex h-svh w-55 shrink-0 flex-col overflow-hidden bg-(--app-frame) transition-[width] duration-200 ease-linear data-[state=collapsed]:w-15 phone:hidden"
          >
            {/* The glow at its foot (globals.css), behind the menu. */}
            <div aria-hidden className="sidebar-glow">
              <div className="sidebar-glow-wave" />
            </div>
            {children}
          </div>
        </SurfaceContext>
      )}

      <Drawer.Backdrop isOpen={isMobileOpen} onOpenChange={setMobileOpen}>
        <Drawer.Content placement="left">
          <Drawer.Dialog aria-label={label} className="w-72 p-0">
            <Drawer.CloseTrigger aria-label={t("common.closeMenu")} />
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
  // The line above it stops short of the rail's edges (20px in), as Shopify's.
  return (
    <div className="relative shrink-0 p-2 before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-(--nav-divider)">
      {children}
    </div>
  );
}

/** The navigation links, exposed to assistive technology as a labelled navigation landmark. */
export function SidebarMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-col">{children}</ul>
    </nav>
  );
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
          className="flex h-[30px] items-center gap-3 rounded-xl px-2.5 text-sm text-foreground outline-none hover:bg-(--nav-hover) focus-visible:ring-2 focus-visible:ring-focus aria-[current=page]:bg-(--nav-selected) aria-[current=page]:font-medium group-data-[state=collapsed]/sidebar:mx-auto group-data-[state=collapsed]/sidebar:w-8 group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0 [&>svg]:size-4 [&>svg]:shrink-0"
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
  const { t } = useLocale();

  return (
    <Button isIconOnly size="sm" variant="ghost" aria-label={t("common.toggleMenu")} onPress={toggle}>
      <LayoutSideContentLeft className="size-4" />
    </Button>
  );
}

/**
 * The rail's own collapse/expand button, in its header. Open, it sits at the header's end; collapsed, it takes the
 * logo's place and shows the logo, turning into the expand icon while pointed at or focused. Not in the drawer,
 * which has its close button.
 */
export function SidebarRailToggle({ logo }: { logo: ReactNode }) {
  const { toggle } = useSidebar();
  const { isCollapsed, isDrawer } = useSidebarSurface();
  const { t } = useLocale();
  if (isDrawer) return null;
  const label = t(isCollapsed ? "nav.expand" : "nav.collapse");

  return (
    <Tooltip delay={300} closeDelay={0}>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        aria-label={label}
        aria-keyshortcuts="Control+B"
        aria-expanded={!isCollapsed}
        onPress={toggle}
        className="group/toggle ms-auto h-[30px] w-8 min-w-0 shrink-0 rounded-full hover:bg-(--nav-selected) data-[hovered=true]:bg-(--nav-selected) group-data-[state=collapsed]/sidebar:ms-0"
      >
        {isCollapsed && <span className="contents group-hover/toggle:hidden group-focus-visible/toggle:hidden [&>*]:size-[30px]">{logo}</span>}
        <LayoutSideContentLeft
          className={
            isCollapsed
              ? "hidden size-4 group-hover/toggle:block group-focus-visible/toggle:block"
              : "size-4 opacity-70 group-hover/toggle:opacity-100 group-focus-visible/toggle:opacity-100"
          }
        />
      </Button>
      <Tooltip.Content placement="right" className="flex items-center gap-2">
        <span className="font-medium">{label}</span>
        <span aria-hidden className="flex gap-1">
          <Kbd className="text-[0.625rem] uppercase">Ctrl</Kbd>
          <Kbd className="text-[0.625rem] uppercase">B</Kbd>
        </span>
      </Tooltip.Content>
    </Tooltip>
  );
}

/** The page next to the sidebar. */
export function SidebarMain({ children }: { children: ReactNode }) {
  return <div className="me-(--app-frame-gap) flex min-w-0 flex-1 flex-col">{children}</div>;
}
