"use client";

import { useState, type ReactNode } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Breadcrumbs, Button } from "@heroui/react";
import { Bell, Magnifier } from "@gravity-ui/icons";
import { UserMenu, useCurrentUser } from "@/features/auth";
import { ProfileDrawer } from "@/features/profile";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMain,
  SidebarMenu,
  SidebarMenuLink,
  SidebarProvider,
  SidebarRailToggle,
  SidebarTrigger,
} from "@/shared/ui/sidebar";
import { accountPages, isNavItemActive, isNavItemVisible, navigation } from "./navigation";
import { useLocale } from "@/shared/i18n";

/** Layout of every signed-in page: permission-aware sidebar, top bar with the page title, content. */
export function AppShell({ defaultCollapsed, children }: { defaultCollapsed: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const { hasPermission } = useCurrentUser();
  const [isProfileOpen, setProfileOpen] = useState(false);
  const { t } = useLocale();

  const items = navigation.filter((item) => isNavItemVisible(item, hasPermission));
  const current = [...items, ...accountPages].find((item) => isNavItemActive(item, pathname));
  const logo = (
    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm text-accent-foreground">
      P
    </span>
  );

  return (
    <SidebarProvider defaultCollapsed={defaultCollapsed}>
      <Sidebar label={t("nav.menu")}>
        <SidebarHeader>
          {/* Collapsed, the logo is the expand button (SidebarRailToggle) and this link leaves the rail. */}
          <NextLink
            href="/"
            className="flex min-w-0 items-center gap-2 rounded-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus group-data-[state=collapsed]/sidebar:hidden"
          >
            {logo}
            <span className="truncate">Portal</span>
          </NextLink>
          <SidebarRailToggle logo={logo} />
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu label={t("nav.main")}>
            {items.map((item) => (
              <SidebarMenuLink key={item.href} href={item.href} icon={<item.icon />} isActive={item === current}>
                {item.labelKey ? t(item.labelKey) : item.label}
              </SidebarMenuLink>
            ))}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter>
          <UserMenu onOpenProfile={() => setProfileOpen(true)} />
        </SidebarFooter>
      </Sidebar>

      <SidebarMain>
        {/* The frame shows above the sheet's rounded top, and stays there as the page scrolls under it. */}
        <header className="sticky top-0 z-10 h-(--app-header-height) bg-(--app-frame) pt-(--app-frame-gap) phone:bg-background">
          <div className="flex h-full items-center gap-3 rounded-t-2xl border-b border-separator bg-(--app-sheet) px-4 text-foreground phone:rounded-none">
            {/* Off a phone the rail has its own button (SidebarRailToggle); this one opens the phone's drawer. */}
            <span className="hidden phone:contents">
              <SidebarTrigger />
            </span>
            {current && (
              <Breadcrumbs className="min-w-0">
                <Breadcrumbs.Item className="min-w-0 font-semibold">
                  <span className="flex min-w-0 items-center gap-2">
                    <current.icon className="size-4 shrink-0" />
                    <span className="truncate">{current.labelKey ? t(current.labelKey) : current.label}</span>
                  </span>
                </Breadcrumbs.Item>
              </Breadcrumbs>
            )}
            <div className="ms-auto flex items-center gap-1">
              <Button isIconOnly aria-label={t("common.search")} variant="ghost">
                <Magnifier className="size-4" />
              </Button>
              <Button isIconOnly aria-label={t("common.notifications")} variant="ghost">
                <Bell className="size-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Its padding (globals.css: 12px, 24px from `sm`) is what full-height pages leave room for. */}
        <main className="flex-1 bg-(--app-sheet) p-(--app-main-padding)">{children}</main>
      </SidebarMain>

      <ProfileDrawer isOpen={isProfileOpen} onOpenChange={setProfileOpen} />
    </SidebarProvider>
  );
}
